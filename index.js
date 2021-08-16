const ssbSingleton = require('ssb-browser-core/ssb-singleton')

function ssbReady(sbot) {
  console.log("got sbot", sbot)
  sbot.net.metafeeds.create((err, metafeed) => {
    console.log("I have a meta feed", metafeed)
  })
}

function extraModules(secretStack) {
  return secretStack.use(require("ssb-meta-feeds"))
}

// in case you want to add or overwrite something from here
// https://github.com/arj03/ssb-browser-core/blob/master/net.js#L11
let config = {}

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
