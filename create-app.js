// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: LGPL-3.0-only

module.exports = function () {
  const pull = require('pull-stream')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

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
        source: ''
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
        ssbSingleton.getSimpleSSBEventually(
          (err, SSB) => {
            SSB.metafeeds.findOrCreate((err, metafeed) => {
              const details = {
                feedpurpose: '8K/applications',
                feedformat: 'classic',
              }

              SSB.metafeeds.findOrCreate(
                metafeed,
                (f) => f.feedpurpose === details.feedpurpose,
                details,
                (err, appFeed) => {
                  SSB.db.publishAs(appFeed.keys, {
                    type: '8K/application',
                    title: this.title,
                    source: this.source
                  }, (err, msg) => {
                    if (err) console.log(err)
                    else alert("App created!")
                  })
                }
              )
            })
          }
        )
      },

      created: function () {
        document.title = '8K - create app'
      }
    }
  }
}
