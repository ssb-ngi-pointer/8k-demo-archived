// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: CC0-1.0

let profileFeed = null

function getProfileFeed(SSB, cb) {
  if (profileFeed !== null) return cb(null, profileFeed)

  SSB.metafeeds.findOrCreate((err, metafeed) => {
    const details = {
      feedpurpose: '8K/profile',
      feedformat: 'classic'
    }

    SSB.metafeeds.findOrCreate(
      metafeed,
      (f) => f.feedpurpose === details.feedpurpose,
      details,
      (err, feed) => {
        if (err) return cb(err)

        profileFeed = feed
        cb(null, profileFeed)
      }
    )
  })
}

return {
  template: `
    <div id="app">
      <h2>Profile</h2>
      <img :src='imageURL' style="max-width: 500px; max-height: 500px;"><br>
      <input type="file" v-on:change="onFileSelect"><br>
      <input id="name" type="text" v-model="name" placeholder="nickname" @keyup.enter="save()">
      <button v-on:click="save">Save</button>
    </div>`,

  data: function() {
    return {
      name: '',
      image: '',
      imageURL: '',
      componentStillLoaded: false,
    }
  },

  methods: {
    onFileSelect: function(ev) {
      const file = ev.target.files[0]

      if (!file) return

      var self = this;
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
                    self.imageURL = url
                    self.image = blobId
                  }
                })
              })
            } else
              alert("failed to add img", err)
          })
        })
      })
    },

    save: function() {
      if (this.name === '') return

      ssbSingleton.getSimpleSSBEventually(
        (err, SSB) => {
          getProfileFeed(SSB, (err, profileFeed) => {
            if (err) return console.error(err)

            SSB.db.publishAs(profileFeed.keys, {
              type: '8K/profile',
              name: this.name,
              image: this.image
            }, (err, msg) => {
              if (err) console.log(err)
              else {
                alert("profile set!")
              }
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
      const { where, and, type, author, toPullStream } = SSB.db.operators

      ssbSingleton.getSimpleSSBEventually(
        (err, SSB) => {
          getProfileFeed(SSB, (err, profileFeed) => {
            pull(
              SSB.db.query(
                where(and(type('8K/profile'), author(profileFeed.keys.id))),
                toPullStream()
              ),
              pull.drain((msg) => {
                const { name, image } = msg.value.content
                this.name = name
                this.image = image
                SSB.blobs.localGet(image, (err, url) => {
                  this.imageURL = url
                })
              })
            )
          })
        }
      )
    }
  },

  created: function () {
    this.componentStillLoaded = true

    document.title = '8K - profile'

    this.load()
  },

  destroyed: function () {
    this.componentStillLoaded = false
  }
}
