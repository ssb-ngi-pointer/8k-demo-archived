const ssbSingleton = require('ssb-browser-core/ssb-singleton')
const pull = require('pull-stream')

const app = new Vue({
  el: '#apps',

  data: function() {
    return {
      id: '',
      apps: [
        { Title: 'chat' }
      ],
      peers: []
    }
  },

  methods: {
    useApp: function(app) {
      const chat = require('./chat')()
      new Vue(chat)
      // FIXME: load source from db using msgId
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

function ssbReady(SSB) {
  console.log("got sbot", SSB)

  app.id = SSB.net.id

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

  SSB.net.on('rpc:connect', function (rpc, isClient) {
    SSB.net.ebt.request(rpc.id, true)
  })

  // find all meta feeds and replicate those
}

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
