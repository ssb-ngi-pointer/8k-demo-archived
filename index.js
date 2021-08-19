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
  }
}

// setup ssb browser core
ssbSingleton.setup("/.ssb-8k", config, extraModules, () => {})

ssbSingleton.getSSBEventually(
  -1,
  () => { return true },
  (SSB) => { return SSB && SSB.net },
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
  const { toPullStream } = SSB.dbOperators

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

function replicateFeeds(SSB, filter, msgToFeed) {
  const { where, live, toPullStream } = SSB.dbOperators
  pull(
    SSB.db.query(
      where(filter),
      live({ old: true }),
      toPullStream()
    ),
    pull.drain((msg) => {
      console.log("replicating", msgToFeed(msg))
      // similar to ack self, we must ack own feeds!
      SSB.net.ebt.request(msgToFeed(msg), true)
    })
  )
}

function ssbReady(SSB) {
  //console.log("got sbot", SSB)
  //dumpDB()

  app.id = SSB.net.id

  const { where, type, author, slowEqual, live, toPullStream } = SSB.dbOperators

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

  SSB.net.connectAndRemember('wss:between-two-worlds.dk:9999~shs:7R5/crt8/icLJNpGwP2D7Oqz2WUd7ObCIinFKVR6kNY=', {
    key: '@7R5/crt8/icLJNpGwP2D7Oqz2WUd7ObCIinFKVR6kNY=.ed25519',
    type: 'room'
  })

  pull(
    SSB.net.conn.hub().listen(),
    pull.drain((ev) => {
      if (ev.type.indexOf("failed") >= 0)
        console.warn("Connection error: ", ev)
    })
  )

  // promiscous mode, we connect to all and replicate all

  pull(
    SSB.net.conn.stagedPeers(),
    pull.drain((entries) => {
      for (const [addr, data] of entries) {
        const delay = Math.floor(Math.random() * (2000 - 1000 + 1) + 1000)
        // delayed connect to handle concurrency
        setTimeout(() => {
          if (SSB.net.conn.query().peersConnected().some(p => p[0] === addr)) {
            //console.log("already connected, skipping")
            return
          }

          SSB.net.conn.connect(addr, data)
        }, delay)
      }
    })
  )

  pull(
    SSB.net.conn.peers(),
    pull.drain((entries) => {
      app.peers = entries.filter(([, x]) => !!x.key).map(([address, data]) => ({ address, data }))
    })
  )

  // must ack self
  SSB.net.ebt.request(SSB.net.id, true)

  SSB.net.on('rpc:connect', function (rpc, isClient) {
    SSB.net.ebt.request(rpc.id, true)
  })

  // find all meta feeds and replicate those
  replicateFeeds(SSB, type('metafeed/announce'),
                 msg => msg.value.content.metafeed)

  // find applications & all specific application feeds created and replicate those
  SSB.net.metafeeds.create((err, metafeed) => {
    pull(
      SSB.db.query(
        where(author(metafeed.keys.id)),
        live({ old: true }),
        toPullStream()
      ),
      pull.drain((msg) => {
        const { feedpurpose } = msg.value.content
        if (feedpurpose !== 'main') {
          replicateFeeds(SSB, slowEqual('value.content.feedpurpose', feedpurpose),
                         msg => msg.value.content.subfeed)
        }
      })
    )
  })
}
