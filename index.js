const ssbSingleton = require('ssb-browser-core/ssb-singleton')
const pull = require('pull-stream')

const app = new Vue({
  el: '#apps',

  data: function() {
    return {
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

function ssbReady(sbot) {
  console.log("got sbot", sbot)

  SSB.net.connectAndRemember('wss:between-two-worlds.dk:9999~shs:7R5/crt8/icLJNpGwP2D7Oqz2WUd7ObCIinFKVR6kNY=', {
    key: '@7R5/crt8/icLJNpGwP2D7Oqz2WUd7ObCIinFKVR6kNY=.ed25519',
    type: 'room'
  })

  pull(SSB.net.conn.hub().listen(), pull.drain((ev) => {
    if (ev.type.indexOf("failed") >= 0)
      console.warn("Connection error: ", ev)
  }))

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
}

function extraModules(secretStack) {
  return secretStack
    .use(require("ssb-meta-feeds"))
}

// in case you want to add or overwrite something from here
// https://github.com/arj03/ssb-browser-core/blob/master/net.js#L11
let config = {
  connections: {
    incoming: {
      tunnel: [{ scope: 'public', transform: 'shs' }]
    },
    outgoing: {
      net: [{ transform: 'shs' }],
      ws: [{ transform: 'shs' }, { transform: 'noauth' }],
      tunnel: [{ transform: 'shs' }]
    }
  },
  conn: {
    populatePubs: false
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
