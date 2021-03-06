// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: LGPL-3.0-only

const ssbSingleton = require('ssb-browser-core/ssb-singleton')
const pull = require('pull-stream')
const source = require('./source')

function extraModules(secretStack) {
  return secretStack
    .use(require("ssb-meta-feeds"))
}

let config = {
  connections: {
    incoming: {
      tunnel: [{ scope: 'public', transform: 'shs' }]
    },
    outgoing: {
      ws: [{ transform: 'shs' }],
      tunnel: [{ transform: 'shs' }]
    }
  },
  conn: {
    populatePubs: false
  },
  ebt: {
    logging: false
  },
  blobs: {
    max: 10 * 1024 * 1024
  }
}

// setup ssb browser core
ssbSingleton.setup("/.ssb-8k", config, extraModules, () => {})

ssbSingleton.getSimpleSSBEventually(
  (err, SSB) => {
    if (err) console.error(err)
    else ssbReady(SSB)
  }
)

const createApp = require('./create-app')()

const app = new Vue({
  el: '#menu',

  data: function() {
    return {
      id: '',
      apps: [],
      peers: []
    }
  },

  methods: {
    useApp: function(app) {
      new Vue(app.code(pull, ssbSingleton)).$mount("#app")
    },
    newApp: function() {
      new Vue(createApp)
    },
    sourceApp: function(app) {
      new Vue(source(app.title, app.source))
    }
  }
})

function dumpDB() {
  const { toPullStream } = SSB.db.operators

  pull(
    SSB.db.query(
      toPullStream()
    ),
    pull.drain((msg) => {
      console.log(`author ${msg.value.author}, seq: ${msg.value.sequence}`)
      // , content: ${JSON.stringify(msg.value.content, null, 2)}
    })
  )
}

function getFunctionBody(f){
  var fStr = f.toString()
  return fStr.substring(fStr.indexOf('{')+1, fStr.lastIndexOf('}'))
}

function ssbReady(SSB) {
  //console.log("got sbot", SSB)
  //dumpDB()

  app.id = SSB.id

  SSB.ebt.registerFormat(require('ssb-ebt/formats/bendy-butt'))

  const { where, type, author, slowEqual, live,
          toPullStream, toCallback } = SSB.db.operators

  // load default app
  const chatApp = require('./chat')
  new Vue(chatApp(pull, ssbSingleton)).$mount("#app")

  app.apps.push({
    title: 'chat',
    code: chatApp,
    source: getFunctionBody(chatApp)
  })

  // add created apps

  pull(
    SSB.db.query(
      where(type('8K/application')),
      live({ old: true }),
      toPullStream()
    ),
    pull.drain((msg) => {
      try {
        app.apps.push({
          title: msg.value.content.title,
          code: new Function('pull', 'ssbSingleton', msg.value.content.source),
          source: msg.value.content.source
        })
      } catch (e) {
        console.log("error creating app", e)
      }
    })
  )

  const roomKey = '@Px7ZxMT4mtpqiNH+PHyao9+o0RdQ/nzU5qznf7WMNIE=.ed25519'
  const room = 'wss:between-two-worlds.dk:443~shs:Px7ZxMT4mtpqiNH+PHyao9+o0RdQ/nzU5qznf7WMNIE='

  SSB.conn.connect(room, {
    key: roomKey,
    type: 'room'
  }, () => {})

  pull(
    SSB.conn.hub().listen(),
    pull.drain((ev) => {
      if (ev.type.indexOf("failed") >= 0)
        console.warn("Connection error: ", ev)
    })
  )

  let delayedConnections = 0
  const maxConnections = 4 // 3 + room

  // promiscous mode, we connect to all and replicate all
  pull(
    SSB.conn.stagedPeers(),
    pull.drain((entries) => {
      if (app.peers.length + delayedConnections >= maxConnections)
        return

      for (const [addr, data] of entries) {
        if (app.peers.length + delayedConnections >= maxConnections)
          break

        delayedConnections += 1

        const delay = Math.floor(Math.random() * (2000 - 1000 + 1) + 1000)
        // delayed connect to handle concurrency
        setTimeout(() => {
          delayedConnections -= 1
          if (SSB.conn.query().peersConnected().some(p => p[0] === addr)) {
            //console.log("already connected, skipping")
            return
          }

          SSB.conn.connect(addr, data)
        }, delay)
      }
    })
  )

  pull(
    SSB.conn.peers(),
    pull.drain((entries) => {
      app.peers = entries.filter(([, x]) => !!x.key).map(([address, data]) => ({ address, data }))
    })
  )

  setInterval(() => {
    if (app.peers.length === 0) {
      SSB.conn.connect(room, {
        key: roomKey,
        type: 'room'
      })
    }
  }, 1000)

  // must ack self
  SSB.ebt.request(SSB.id, true)

  // main feed replicated on rpc connect
  SSB.on('rpc:connect', function (rpc, isClient) {
    if (rpc.id !== roomKey) {
      console.log("request connect", rpc.id)
      SSB.ebt.request(rpc.id, true)
    }
  })

  // find all meta feeds & children and replicate those
  pull(
    SSB.db.query(
      where(type('metafeed/announce')),
      live({ old: true }),
      toPullStream()
    ),
    pull.drain((msg) => {
      const { metafeed } = msg.value.content
      console.log("replicating mf", metafeed)
      // similar to ack self, we must ack own feeds!
      SSB.ebt.request(metafeed, true)

      pull(
        SSB.db.query(
          where(author(metafeed)),
          live({ old: true }),
          toPullStream()
        ),
        pull.drain((msg) => {
          const { subfeed, feedpurpose } = msg.value.content
           // FIXME: some kind of UI to toggle what feedpurposes to replicate
          if (feedpurpose !== 'main') { // special
            console.log("replicating subfeed", subfeed)
            // similar to ack self, we must ack own feeds!
            SSB.ebt.request(subfeed, true)
          }
        })
      )
    })
  )

  // replicate non-direct connections

  pull(
    SSB.db.query(
      where(type('replication')),
      live({ old: true }),
      toPullStream()
    ),
    pull.drain((msg) => {
      const { feed } = msg.value.content
      console.log("replicating non-direct", feed)
      SSB.ebt.request(feed, true)
    })
  )

  // maintain a list of main feeds we have seen (friends-lite)

  SSB.metafeeds.findOrCreate((err, metafeed) => {
    const details = {
      feedpurpose: 'replication',
      feedformat: 'classic',
    }

    SSB.metafeeds.findOrCreate(
      metafeed,
      (f) => f.feedpurpose === details.feedpurpose,
      details,
      (err, replicationFeed) => {
        SSB.db.query(
          where(author(replicationFeed.keys.id)),
          toCallback((err, messages) => {
            if (err) console.error(err)

            let existing = messages.map(msg => {
              return msg.value.content.feed
            })

            pull(
              SSB.db.query(
                where(type('metafeed/announce')),
                live({ old: true }),
                toPullStream()
              ),
              pull.drain((msg) => {
                const { author } = msg.value
                if (!existing.includes(author)) {
                  SSB.db.publishAs(replicationFeed.keys, {
                    type: 'replication',
                    feed: author
                  }, (err, msg) => {
                    if (err) console.error("failed to add replication", err)
                  })

                  existing.push(author)
                }
              })
            )
          })
        )
      })
  })
}
