// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: CC0-1.0

module.exports = function (pull, ssbSingleton) {
  let chatFeed = null

  function getChatFeed(SSB, cb) {
    if (chatFeed !== null) return cb(null, chatFeed)

    SSB.metafeeds.findOrCreate((err, metafeed) => {
      const details = {
        feedpurpose: '8K/chat',
        feedformat: 'classic',
      }

      SSB.metafeeds.findOrCreate(
        metafeed,
        (f) => f.feedpurpose === details.feedpurpose,
        details,
        (err, feed) => {
          if (err) return cb(err)

          chatFeed = feed
          cb(null, chatFeed)
        }
      )
    })
  }

  return {
    template: `
    <div id="app">
      <h2>Chat</h2>
      <input type='text' v-model="message" @keyup.enter="post()">
      <button v-on:click="post">Send</button>
      <div v-for="msg in messages">
       <span>{{ msg.user }}:</span>
       <span>{{ msg.text }}</span>
      </div>
    </div>`,

    data: function() {
      return {
        message: '',
        messages: [],
        componentStillLoaded: false,
      }
    },

    methods: {
      post: function() {
        if (this.message === '') return

        ssbSingleton.getSimpleSSBEventually(
          (err, SSB) => {
            getChatFeed(SSB, (err, chatFeed) => {
              SSB.db.publishAs(chatFeed.keys, {
                type: '8K/chat',
                message: this.message
              }, (err, msg) => {
                if (err) console.log(err)
                else this.message = ''
              })
            })
          }
        )
      },
      
      load: function() {
        ssbSingleton.getSimpleSSBEventually(
          this.render
        )
      },

      render: function(err, SSB) {
        const { where, type, live, toPullStream } = SSB.db.operators

        pull(
          SSB.db.query(
            where(type('8K/chat')),
            live({ old: true }),
            toPullStream()
          ),
          pull.drain((msg) => {
            this.messages.push({
              user: msg.value.author.substring(0,5),
              text: msg.value.content.message
            })
          })
        )
      }
    },

    created: function () {
      this.componentStillLoaded = true

      document.title = '8K - chat'

      this.load()
    },

    destroyed: function () {
      this.componentStillLoaded = false
    }
  }
}
