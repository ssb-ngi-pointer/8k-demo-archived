// SPDX-FileCopyrightText: 2021 Anders Rune Jensen <arj03@protonmail.ch>
//
// SPDX-License-Identifier: LGPL-3.0-only

module.exports = function (title, source) {
  return {
    el: '#app',
    
    template: `
    <div id="app">
      <h2>Source code for {{ title }}</h2>
      <button class="link" v-on:click="copy">Copy to clipboard</button>
      <pre>{{ source }}</pre>
    </div>`,

    data: function() {
      return {
        title,
        source
      }
    },

    methods: {
      copy: function() {
        navigator.clipboard.writeText(this.source)
        alert('Copied')
      }
    }
  }
}
