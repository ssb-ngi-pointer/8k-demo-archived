// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: CC0-1.0

let newsFeed = null

function getNewsFeed(SSB, cb) {
  if (newsFeed !== null) return cb(null, newsFeed)

  SSB.net.metafeeds.findOrCreate((err, metafeed) => {
    const details = {
      feedpurpose: '8K/news',
      feedformat: 'classic',
    }

    SSB.net.metafeeds.findOrCreate(
      metafeed,
      (f) => f.feedpurpose === details.feedpurpose,
      details,
      (err, feed) => {
        if (err) return cb(err)

        newsFeed = feed
        cb(null, newsFeed)
      }
    )
  })
}

return {
  template: `
    <div id="app">
      <h2>News</h2>
      <p>A small news aggregator</p>
      <h4>Submit news</h4>
      <div style="width: 480px; display: flex; flex-direction: column;">
        <label for='url'>URL</label>
        <input id='url' type='url' v-model="url">
        <label for='title'>Title</label>
        <input id='title' type='text' v-model="title">
        <label for='description'>Description</label>
        <textarea id='description' v-model="description"></textarea>
        <button v-on:click="add">Add</button>
      </div>
      <hr>
      <h4>News</h4>
      <ul v-for="item in news">
        <li>
          <a :href="item.url" target="_blank">{{ item.title }}</a>: {{item.description}} <span style="font-size: 7pt; color: lightgray;">posted on {{item.timestamp}} by {{item.user}}</span>
         <div v-for="comment in item.comments">
           {{ comment.text }} posted {{ comment.timestamp }} by {{ comment.user }}
         </div>
         <br>
         <textarea v-model="comment"></textarea>
         <br>
         <button v-on:click="addcomment(item.id)">Add comment</button>
        </li>
      </ul>
    </div>`,

  data: function() {
    return {
      url: '',
      title: '',
      description: '',
      news: [],
      comment: '',
      componentStillLoaded: false,
    }
  },

  methods: {
    add: function() {
      if (this.url === '') return

      ssbSingleton.getSimpleSSBEventually(
        () => this.componentStillLoaded,
        (err, SSB) => {
          getNewsFeed(SSB, (err, newsFeed) => {
            SSB.db.publishAs(newsFeed.keys, {
              type: '8K/news',
              url: this.url,
              title: this.title,
              description: this.description
            }, (err, msg) => {
              if (err) {
                console.log(err)
              } else {
                this.url = ''
                this.description = ''
                this.title = ''
              }
            })
          })
        }
      )
    },

    addcomment: function(itemKey) {
      ssbSingleton.getSimpleSSBEventually(
        () => this.componentStillLoaded,
        (err, SSB) => {
          getNewsFeed(SSB, (err, newsFeed) => {
            SSB.db.publishAs(newsFeed.keys, {
              type: '8K/news/comment',
              news: itemKey,
              comment: this.comment,
            }, (err, msg) => {
              if (err) {
                console.log(err)
              } else {
                this.comment = ''
              }
            })
          })
        }
      )
    },
    
    load: function() {
      ssbSingleton.getSimpleSSBEventually(
        () => this.componentStillLoaded,
        this.render
      )
    },

    render: function(err, SSB) {
      const { where, type, descending, live, toPullStream } = SSB.dbOperators

      pull(
        SSB.db.query(
          where(type('8K/news')),
          live({old: true}),
          toPullStream()
        ),
        pull.drain((msg) => {
          this.news.push({
            id: msg.key,
            user: msg.value.author.substring(0,5),
            timestamp: (new Date(msg.value.timestamp)).toLocaleString(),
            url: msg.value.content.url,
            title: msg.value.content.title,
            description: msg.value.content.description,
            comments: []
          })
        })
      )

      pull(
        SSB.db.query(
          where(type('8K/news/comment')),
          live({old: true}),
          toPullStream()
        ),
        pull.drain((msg) => {
          const { news, comment } = msg.value.content
          const newsItem = this.news.find(x => x.id === news)
          if (newsItem) {
            newsItem.comments.push({
              text: comment,
              user: msg.value.author.substring(0,5),
              timestamp: (new Date(msg.value.timestamp)).toLocaleString()
            })
          }
        })
      )      
    }
  },

  created: function () {
    this.componentStillLoaded = true

    document.title = '8K - news'

    this.load()
  },

  destroyed: function () {
    this.componentStillLoaded = false
  }
}
