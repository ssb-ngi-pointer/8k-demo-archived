// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: CC0-1.0

let chatFeed

function getChatFeed(SSB) {
  SSB.net.metafeeds.findOrCreate((err, metafeed) => {
    const details = {
      feedpurpose: '8K/chat',
      feedformat: 'classic'
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
  template: `
    <div id="app">
      <h2>Chat</h2>
      <input type='text' v-model="message" @keyup.enter="post()">
      <button v-on:click="post">Send</button>
      <div v-for="msg in messages">
       <span>{{ msg.timestamp }} <img v-bind:src='msg.img' style="max-width: 25px; max-height: 25px;"> {{ msg.user }}:</span>
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

    render: async function(err, SSB) {
      getChatFeed(SSB)

      const { where, or, type, descending, live,
              toPullStream, toPromise, toCallback } = SSB.dbOperators

      const profiles = await SSB.db.query(
        where(
          type('8K/profile')
        ),
        descending(),
        toPromise()
      )

      console.log("profiles", profiles)
      
      const metafeedMsgs = await SSB.db.query(
        where(
          or(
            type('metafeed/add/existing'),
            type('metafeed/add/derived')
          )
        ),
        toPromise()
      )

      const metafeeds = {}
      metafeedMsgs.forEach(msg => {
        const msgVal = msg.value
        const content = msgVal.content
        const metafeed = metafeeds[msgVal.author] || {}
        metafeed[content.feedpurpose] = content.subfeed
        metafeeds[msgVal.author] = metafeed
      })
      
      console.log("metafeeds", metafeeds)

      const chatToMetafeed = {}
      for (let metafeed in metafeeds) {
        const chatId = metafeeds[metafeed]['8K/chat']
        if (chatId)
          chatToMetafeed[chatId] = metafeeds[metafeed]
      }
      
      pull(
        SSB.db.query(
          where(type('8K/chat')),
          live({old: true}),
          toPullStream()
        ),
        pull.drain((msg) => {
          const { timestamp, author, content } = msg.value
          const authorChat = chatToMetafeed[author]
          if (authorChat) {
            const profileId = authorChat['8K/profile']
            const mainId = authorChat['main']
            const profile = profileId ? profiles.find(msg => {
              return msg.value.author === profileId
            }) : undefined

            const chatMessage = {
              timestamp: (new Date(timestamp)).toLocaleString(),
              user: profile ? profile.value.content.name : mainId.substring(0,5),
              img: '',
              text: msg.value.content.message
            }

            if (profile && profile.value.content.image) {
              console.log("getting img", profile.value.content.image)
              const peers = SSB.net.conn.query().peersConnected()
              SSB.net.blobs.getBlob(profile.value.content.image, peers, (err, url) => {
                console.log("setting img", url)
                chatMessage.img = url
              })
            }

            this.messages.push(chatMessage)
          }
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
