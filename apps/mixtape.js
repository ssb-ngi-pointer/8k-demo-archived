// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: CC0-1.0

let feed = null

function getFeed(SSB, cb) {
  if (feed !== null) return cb(null, feed)

  SSB.net.metafeeds.findOrCreate((err, metafeed) => {
    const details = {
      feedpurpose: '8K/mixtape',
      feedformat: 'classic',
    }

    SSB.net.metafeeds.findOrCreate(
      metafeed,
      (f) => f.feedpurpose === details.feedpurpose,
      details,
      (err, f) => {
        if (err) return cb(err)

        feed = f
        cb(null, feed)
      }
    )
  })
}

return {
  template: `
    <div id="app">
      <h2>8 Kloud - Mixtapes</h2>
      <p>Create and share 8-songs mixtapes.</p>
      <nav style="border-bottom: 1px solid black;">
        <ol style="list-style-type: none; padding-left: 0;">
          <li style="display: inline-block;"><button v-on:click="showBrowse">Browse Mixtapes</button></li>
          <li style="display: inline-block;"><button v-on:click="showCreate">Create Mixtape</button></li>
        </ol>
      </nav>
      <div id="create-mixtape" v-show="!browse">
        <h4>Create new mixtape</h4>
        <div style="width: 480px; display: flex; flex-direction: column;">
          <label for='title'>Title</label>
          <input id='title' type='text' v-model="title">
          <label for='cover'>Cover URL</label>
          <input id='cover' type='url' v-model="cover">
          <label for='description'>Description</label>
          <textarea id='description' v-model="description"></textarea>
          <div v-for="(song, index) in songs" style="display: flex; flex-direction: column; border: solid 1px gray; padding: 10px; margin-top: 5px;">
            <b>Song {{index}}</b>
            <label>Title</label>
            <input type='text' v-model="song.title">
            <label>URL</label>
            <input type='url' v-model="song.url">
          </div>
          <br>
          <button v-on:click="create">Create</button>
        </div>
      </div>
      <div id="browse-mixtapes" v-show="browse">
        <h4>Mixtapes</h4>
        <div v-for="item in mixtapes" style="display: grid; grid-auto-columns: 1fr; grid-auto-rows: 1fr; gap: 10px 10px;">
          <div style="border: solid 1px gray; padding: 10px; max-width: 400px;">
            <img style="width: 100%; height: 200px; overflow: hidden" v-bind:src="item.cover" />
            <h4>{{item.title}}</h4>
            <p>{{item.description}}</p>
            <figure v-for="song in item.songs">
              <figcaption>{{song.title}}</figcaption>
              <audio v-if="song.url" controls v-bind:src="song.url">
                      Your browser does not support the
                      <code>audio</code> element.
              </audio>
            </figure>
            <span style="font-size: 7pt; color: lightgray;">posted on {{item.timestamp}} by {{item.user}}</span></a>
          </div>
        </div>
      </div>
    </div>`,

  data: function() {
    return {
      browse: true,
      title: '',
      description: '',
      cover: '',
      songs: (new Array(8)).fill({}).map(f => {return {title: '', url: ''}}),
      mixtapes: [],
      componentStillLoaded: false,
    }
  },

  methods: {
    showBrowse: function() {
      this.browse = true
    },
    showCreate: function() {
      this.browse = false
    },
    create: function() {
      if (this.url === '') return

      ssbSingleton.getSimpleSSBEventually(
        () => this.componentStillLoaded,
        (err, SSB) => {
          getFeed(SSB, (err, feed) => {
            SSB.db.publishAs(feed.keys, {
              type: '8K/mixtape',
              cover: this.cover,
              title: this.title,
              description: this.description,
              songs: this.songs
            }, (err, msg) => {
              if (err) {
                console.log(err)
              } else {
                this.cover = ''
                this.description = ''
                this.title = ''
                this.songs = []
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
          where(type('8K/mixtape')),
          live({old: true}),
          toPullStream()
        ),
        pull.drain((msg) => {
          console.log(msg)
          this.mixtapes.push({
            user: msg.value.author.substring(0,5),
            timestamp: (new Date(msg.value.timestamp)).toLocaleString(),
            cover: msg.value.content.cover,
            title: msg.value.content.title,
            description: msg.value.content.description,
            songs: msg.value.content.songs
          })
        })
      )
    }
  },

  created: function () {
    this.componentStillLoaded = true

    document.title = '8K - mixtape'

    this.load()
  },

  destroyed: function () {
    this.componentStillLoaded = false
  }
}
