let profileFeed = null

function getProfileFeed(SSB, cb) {
  if (profileFeed !== null) return cb(null, profileFeed)

  SSB.net.metafeeds.create((err, metafeed) => {
    const details = {
      feedpurpose: '8K/profile',
      feedformat: 'classic'
    }

    SSB.net.metafeeds.findOrCreate(
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
      <input id="name" type="text" v-model="name" placeholder="nickname">
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
      if (!SSB || !SSB.net || !SSB.net.blobs) {
        alert("Can't add file right now.")
        return
      }

      file.arrayBuffer().then(function (buffer) {
        SSB.net.blobs.hash(new Uint8Array(buffer), (err, digest) => {
          var blobId = "&" + digest
          SSB.net.blobs.add(blobId, file, (err) => {
            if (!err) {
              SSB.net.blobs.push(blobId, (err) => {
                SSB.net.blobs.localGet(blobId, (err, url) => {
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
        () => this.componentStillLoaded,
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
                this.name = ''
                this.image = ''
                alert("profile set!")
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
      const { where, and, type, author, toPullStream } = SSB.dbOperators

      ssbSingleton.getSimpleSSBEventually(
        () => this.componentStillLoaded,
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
                SSB.net.blobs.localGet(image, (err, url) => {
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
