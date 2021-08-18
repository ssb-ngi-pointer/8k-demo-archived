module.exports = function () {
  const pull = require('pull-stream')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  function getApplicationsFeed(SSB, cb) {
    SSB.net.metafeeds.create((err, metafeed) => {
      const details = {
        feedpurpose: '8K/applications',
        feedformat: 'classic',
      }

      SSB.net.metafeeds.findOrCreate(
        metafeed,
        (f) => f.feedpurpose === details.feedpurpose,
        details,
        cb
      )
    })
  }
  
  return {
    el: '#app',
    
    template: `
    <div id="app">
      <h2>Create a new app</h2>
      <div>
        <input id="title" type="text" v-model="title" placeholder="app title">
        <button class="link" v-on:click="test">Test</button>
        <button class="link" v-on:click="create">Create</button>
      </div>
      <br>
      <textarea class="source" v-model="source"></textarea>
      <div id="testapp"></div>
    </div>`,

    data: function() {
      return {
        title: '',
        source: '',
        componentStillLoaded: false
      }
    },

    methods: {
      test: function() {
        const fixedSource = this.source.replace('id="app"', 'id="testapp"')
        let code = new Function('pull', 'ssbSingleton', fixedSource)
        new Vue(code(pull, ssbSingleton)).$mount('#testapp')
        // scroll down to app
        window.scrollTo(0, document.body.scrollHeight)
      },

      create: function() {
        const self = this
        ssbSingleton.getSimpleSSBEventually(
          () => this.componentStillLoaded,
          (err, SSB) => {
            getApplicationsFeed(SSB, (err, appFeed) => {
              console.log("appfeed keys", appFeed.keys)
              SSB.db.publishAs(appFeed.keys, {
                type: '8K/application',
                title: self.title,
                source: self.source
              }, (err, msg) => {
                console.log("create app", msg)
                if (err) console.log(err)
                else alert("App created!")
              })
            })
          }
        )
      },

      created: function () {
        this.componentStillLoaded = true

        document.title = '8K - create app'
      },

      destroyed: function () {
        this.componentStillLoaded = false
      }
    }
  }
}
