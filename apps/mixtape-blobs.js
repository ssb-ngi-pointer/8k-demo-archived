// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: CC0-1.0

let feed = null

function getFeed(SSB, cb) {
  if (feed !== null) return cb(null, feed)

  SSB.metafeeds.findOrCreate((err, metafeed) => {
    const details = {
      feedpurpose: '8K/mixtape',
      feedformat: 'classic',
    }

    SSB.metafeeds.findOrCreate(
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
          <input type="file" v-on:change="onCoverSelect"><br>
          <img :src='cover' style="max-width: 500px; max-height: 500px;"><br>
          <label for='description'>Description</label>
          <textarea id='description' v-model="description"></textarea>
          <div v-for="(song, index) in songs" style="display: flex; flex-direction: column; border: solid 1px gray; padding: 10px; margin-top: 5px;">
            <b>Song {{index}}</b>
            <label>Title</label>
            <input type='text' v-model="song.title">
            <label>File</label>
            <input type="file" v-on:change="function(ev) { onFileSelect(ev, song) }"><br>
          </div>
          <br>
          <button v-on:click="create">Create</button>
        </div>
      </div>
      <div id="browse-mixtapes" v-show="browse">
        <h4>Mixtapes</h4>
        <div v-for="item in mixtapes" style="display: grid; grid-auto-columns: 1fr; grid-auto-rows: 1fr; gap: 10px 10px;">
          <div style="border: solid 1px gray; padding: 10px; max-width: 400px;">
            <img style="max-width: 250px; max-height: 250px; overflow: hidden" v-bind:src="item.cover" />
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
      songs: (new Array(8)).fill({}).map(f => {return {title: '', url: '', blob: ''}}),
      mixtapes: [],
      componentStillLoaded: false,
    }
  },

  methods: {
    onCoverSelect: function(ev, song) {
      const file = ev.target.files[0]

      if (!file) return

      [ err, SSB ] = ssbSingleton.getSSB()
      if (!SSB || !SSB.blobs) {
        alert("Can't add file right now.")
        return
      }

      self = this

      file.arrayBuffer().then(function (buffer) {
        SSB.blobs.hash(new Uint8Array(buffer), (err, digest) => {
          var blobId = "&" + digest
          SSB.blobs.add(blobId, file, (err) => {
            if (!err) {
              SSB.blobs.push(blobId, (err) => {
                SSB.blobs.localGet(blobId, (err, url) => {
                  if (!err) {
                    self.cover = url
                    self.coverBlob = blobId
                  }
                })
              })
            } else
              alert("failed to add img", err)
          })
        })
      })
    },

    onFileSelect: function(ev, song) {
      const file = ev.target.files[0]

      if (!file) return

      [ err, SSB ] = ssbSingleton.getSSB()
      if (!SSB || !SSB.blobs) {
        alert("Can't add file right now.")
        return
      }

      file.arrayBuffer().then(function (buffer) {
        SSB.blobs.hash(new Uint8Array(buffer), (err, digest) => {
          var blobId = "&" + digest
          SSB.blobs.add(blobId, file, (err) => {
            if (!err) {
              SSB.blobs.push(blobId, (err) => {
                SSB.blobs.localGet(blobId, (err, url) => {
                  if (!err) {
                    song.url = url
                    song.blob = blobId
                  }
                })
              })
            } else
              alert("failed to add img", err)
          })
        })
      })
    },

    showBrowse: function() {
      this.browse = true
    },
    showCreate: function() {
      this.browse = false
    },
    create: function() {
      if (this.url === '') return

      ssbSingleton.getSimpleSSBEventually(
        (err, SSB) => {
          getFeed(SSB, (err, feed) => {
            SSB.db.publishAs(feed.keys, {
              type: '8K/mixtape',
              cover: this.cover,
              coverBlob: this.coverBlob,
              title: this.title,
              description: this.description,
              songs: this.songs
            }, (err, msg) => {
              if (err) return console.log(err)

              this.browse = true
              this.cover = ''
              this.description = ''
              this.title = ''
              this.songs = []
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
          where(type('8K/mixtape')),
          live({ old: true }),
          toPullStream()
        ),
        pull.drain((msg) => {
          const { author, timestamp, content } =  msg.value
          const { cover, coverBlob, title, description, songs } = content

          const mixtape = {
            user: author.substring(0,5),
            timestamp: (new Date(timestamp)).toLocaleString(),
            cover,
            title,
            description,
            songs
          }
          this.mixtapes.push(mixtape)

          const peers = SSB.conn.query().peersConnected()

          if (coverBlob) {
            SSB.blobs.getBlob(coverBlob, peers, (err, url) => {
              console.log(err)
              mixtape.cover = url
            })
          }

          for (let song of songs) {
            if (song.blob) {
              SSB.blobs.getBlob(song.blob, peers, (err, url) => {
                song.url = url
              })
            }
          }
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
