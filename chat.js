module.exports = function () {
  const pull = require('pull-stream')
  const ssbSingleton = require('ssb-browser-core/ssb-singleton')

  let chatFeed

  function getChatFeed(SSB) {
    SSB.net.metafeeds.create((err, metafeed) => {
      const details = {
        feedpurpose: '8K/chat',
        feedformat: 'classic',
        metadata: {
          source: '' // '%FIXME.ed25519'
        }
      }

      SSB.net.metafeeds.findOrCreate(
        metafeed,
        (f) => f.feedpurpose === details.feedpurpose,
        details,
        (err, feed) => {
          chatFeed = feed
        }
      )
    })
  }
  
  return {
    el: '#app',
    
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
        
        SSB.db.publishAs(chatFeed.keys, {
          type: '8K/chat',
          message: this.message
        }, (err, msg) => {
          if (err) console.log(err)
          else this.message = ''
        })
      },
      
      load: function() {
        ssbSingleton.getSimpleSSBEventually(
          () => this.componentStillLoaded,
          this.render
        )
      },

      render: function(err, SSB) {
        getChatFeed(SSB)

        const { where, type, descending, live, toPullStream } = SSB.dbOperators

        pull(
          SSB.db.query(
            where(type('8K/chat')),
            live({old: true}),
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
