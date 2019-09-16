// ==UserScript==
// @name           dev unlimited favs
// @namespace      mail@zera.tax
// @description    Adds unlimited local favorite lists to sadpanda
// @license        UNLICENSE
// @include        /^https://e(x|-)hentai\.org/.*$/
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_addStyle
// @version        0.8.0
// ==/UserScript==
/* global GM_setValue GM_getValue GM_info GM_addStyle */

(function () {
  // CONSTANTS
  const domain = window.location.hostname
  const imageDomain = (domain === 'exhentai.org') ? 'https://exhentai.org/img' : 'https://ehgt.org/g'
  const favIcon = `background-image:url(${imageDomain}/fav.png); background-position:0px -172px`

  const select = query => window.document.querySelector(query)
  const selectAll = query => window.document.querySelectorAll(query)

  let importString = ''

  // CLASSES
  class FavLists {
    constructor (lists = []) {
      this._lists = lists
    }

    get lists () { return this._lists }

    newList (name = '', id = _ULF.newID(), galleries = []) {
      console.debug(`new List with name: "${name}" and id: "${id}"`)
      const index = _ULF.counter++
      if (!name) {
        name = `Favorites ${9 + index}`
      }
      const list = new FavList(name, id, galleries)
      this._lists.push(list)
    }

    removeList (listID) {
      this._lists.splice(this._lists.findIndex(list => list.id === listID), 1)
    }

    getListByGid (galleryID) {
      return this._lists.find(list => list.getGallery(galleryID))
    }

    getListByLid (listID) {
      return this._lists.find(list => list.id === listID)
    }

    toJSON () {
      return this._lists.map(list => list.toJSON())
    }

    save () {
      _ULF.json.lists = this.toJSON()
      saveGM()
    }
  }

  class FavList {
    constructor (name, id, galleries = []) {
      this._name = name
      this._id = id
      this._galleries = galleries
    }

    get id () { return this._id }
    get name () { return this._name }
    set name (name) {
      this._name = name
    }

    galleries (order = 'faved', search = false) {
      switch (order) {
        case 'faved':
          return this._galleries.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp)
          })
        case 'posted':
          return this._galleries.sort((a, b) => {
            // unix to date: new Date(UNIX_timestamp * 1000);
            return b.info.posted - a.info.posted
          })
        default:
          SyntaxError('"order" has to be either "posted" or "faved"')
      }
    }

    addGallery (id, token, note = '') {
      if (this.getGallery(id)) {
        try {
          const gallery = new Gallery(id, token, note)
          this._galleries.push(gallery)
        } catch (error) {
          window.InternalError('could not get gallery info!')
        }
      } else {
        window.Error('already added to this list!')
      }
      this.save()
    }

    removeGallery (id) {
      this._galleries.filter(gallery => gallery.id === id)
      this.save()
    }

    getGallery (id) {
      return this._galleries.find(gallery => gallery.gid === id)
    }

    toJSON () {
      return {
        name: this._name,
        id: this._id,
        galleries: this._galleries.map(gallery => gallery.toJSON())
      }
    }
  }

  class Gallery {
    constructor (id, token, note = '', timestamp = new Date()) {
      this._id = id
      this._token = token
      this._note = note
      this._timestamp = timestamp
      this._info = getGalleryInfo([this])[0]
    }

    toJSON () {
      return {
        gid: this._id,
        gt: this._token,
        note: this._note,
        timestamp: this._timestamp,
        info: this._info
      }
    }

    get ID () { return this._id }
    get token () { return this._token }
    get note () { return this._note }
    get timestamp () { return this._timestamp }
    get info () { return this._info }
  }

  // FUNCTIONS
  function parser (html) {
    const template = document.createElement('template')
    template.innerHTML = html
    return template.content.firstChild
  }

  // SCRIPT INITIALIZATION
  function createLists () {
    const lists = _ULF.json.lists.map((list) => {
      _ULF.counter++
      return new FavList(list.name, list.id, list.galleries)
    })
    return new FavLists(lists)
  }

  // LOAD SCRIPT
  const _ULF = {
    json: loadGM(),
    counter: 0,
    newID: () => { return '_' + Math.random().toString(36).substr(2, 9) }
  }
  _ULF.dict = createLists()
  console.log(_ULF)

  // USERSCRIPT SPECIFIC
  function clearFavs () {
    _ULF.json = {}
    saveGM()
    window.location.reload()
  }
  // save settings persistently
  function saveGM () {
    // save value to greasemonkey/tampermonkey etc.
    GM_setValue('__unlimitedfavs__', JSON.stringify(_ULF.json))
  }

  // load persistently saved settings, or from a given JSON string
  function loadGM (importString) {
    const GMString = String(importString || GM_getValue('__unlimitedfavs__', ''))
    // set default if no import and no saved version
    const GMJSON = (GMString && GMString !== '{}') ? JSON.parse(GMString) : {
      lists: [{
        name: 'Favorites 10',
        galleries: []
      }],
      display: 'thumb',
      order: 'thumb',
      version: GM_info.script.version
    }
    console.debug(GMJSON)

    // VERSION ADJUSTMENTS
    if (!GMJSON.version) {
      GMJSON.version = '0.6.5'
    }
    if (versionCompare(String(GMJSON.version), '0.7.0') === -1) {
      // fix saved JSONs from < 0.7.0 versions
      // id from string to int
      for (const list of GMJSON.lists) {
        for (const gallery of list.galleries) {
          gallery.gid = parseInt(gallery.gid)
        }
      }
    }
    if (versionCompare(String(GMJSON.version), '0.8.0') === -1) {
    // fix saved JSONs from < 0.8.0 versions
    // rename date to timestamp
      for (const list of GMJSON.lists) {
        list.id = _ULF.newID()
        for (const gallery of list.galleries) {
          gallery.timestamp = gallery.date
          delete gallery.date
        }
      }
    }

    // update version
    GMJSON.version = GM_info.script.version

    return GMJSON
  }

  // SADPANDA API
  function handleErrors (response) {
    if (!response.ok) {
      throw Error(response.statusText)
    }
    return response
  }

  function getGalleryInfo (galleries) {
    // [' + id +', "' + token + '" ]
    const request = new window.Request('https://e-hentai.org/api.php',
      {
        method: 'POST',
        body: `{"method": "gdata", "gidlist": ${galleries.map((gallery) => gallery.id)} + ' }`
      })
    return window.fetch(request)
      .then(handleErrors)
      .then(response => {
        if (response.status === 200) {
          return response.json()
        } else {
          throw new Error('Something went wrong on api server!')
        }
      })
      .then(response => {
        return response.gmetadata
        // ...
      }).catch(error => {
        console.error(error)
      })
  }

  // download file to local storage
  function download (text, name, type) {
    const a = document.createElement('a')
    const file = new window.Blob([text], { type: type })
    a.href = URL.createObjectURL(file)
    a.download = name
    a.click()
  }

  // based on: https://stackoverflow.com/a/6078873
  function timeConverter (epoch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const a = new Date(epoch * 1000)
    const year = a.getFullYear()
    const month = months[a.getMonth()]
    const date = a.getDate()
    const hour = a.getHours()
    const min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes()
    // const sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds()
    const time = year + '-' + month + '-' + date + ' ' + hour + ':' + min

    return time
  }

  // based on: https://gist.github.com/alexey-bass/1115557
  function versionCompare (left, right) {
    if (typeof left + typeof right !== 'stringstring') { return false }

    const a = left.split('.')
    const b = right.split('.')
    let i = 0; const len = Math.max(a.length, b.length)

    for (; i < len; i++) {
      if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
        return 1
      } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
        return -1
      }
    }

    return 0
  }

  // UI-MODIFICATIONS
  // create list name input to rename/delete/add list
  let inputcounter = 0
  function newInput (name, id, template, counter, last = false) {
    const selection = template.cloneNode(true)
    const input = selection.lastElementChild.lastElementChild

    input.name = `favorite_${10 + counter}`
    input.placeholder = 'new list...'
    input.setAttribute('lid', id)
    input.value = name
    input.classList.add('ulf', 'ulf_list_rename')

    input.addEventListener('focusout', event => clickDeleteList(event.srcElement))
    if (last) {
      input.id = 'ulf_last_input'
      input.addEventListener('focusout', event => clickAddList(event.srcElement))
    }

    selection.querySelector('.i').style.filter = `invert(100%) hue-rotate(${inputcounter * 35}deg)`
    inputcounter++

    return selection
  }

  // BUTTON FUNCTIONS
  const clickDeleteList = (input) => {
    const value = input.value.trim()
    const id = input.getAttribute('lid')

    if (input.id === 'ulf_last_input') {
      return
    }
    if (!value) {
      // delete list
      console.debug(`deleting list ${id}`)
      try {
        if (_ULF.dict.getListByLid(id).galleries().length) {
          const response = window.confirm('This list contains still contains galleries, delete anyways?')
          if (!response) { return }
        }
        _ULF.dict.removeList(id)
      } catch (error) {
        console.error(error)
        window.alert('could not delete gallery')
        return
      }
      input.parentElement.parentElement.remove()
      inputcounter--
    } else {
      // rename list
      const list = _ULF.dict.getListByLid(id)
      if (!list) {
        console.error(`list with ${id} not found`)
        return
      }
      if (list.name !== value) {
        console.debug(`changing ${list.name} to ${value}`)
        try {
          list.name = value
        } catch (error) {
          console.log(error)
        }
      }
    }
    _ULF.dict.save()
  }

  const clickAddList = (input) => {
    const favsel = select('#favsel')
    const template = input.parentElement.parentElement.cloneNode(true)
    const id = input.getAttribute('lid')

    if (input.id !== 'ulf_last_input') {
      return
    }
    if (input.value.trim() !== '') {
      console.debug('creating new list...')
      _ULF.dict.newList(input.value, id)
      input.removeAttribute('id')
      input.classList.add('rename')

      favsel.appendChild(newInput('', _ULF.newID(), template, _ULF.counter, true))
    }

    _ULF.dict.save()
  }

  const clickImport = (input) => {
    if (!importString) {
      window.alert('no file selected!')
      return
    }
    try {
      _ULF.json = loadGM(importString)
    } catch (err) {
      window.alert('no valid json supplied')
      return
    }
    saveGM()
    console.log('imported:')
    console.log(_ULF.json)
    window.location.reload()
  }

  const clickFileImport = (input) => {
    var reader = new window.FileReader()
    reader.onload = function () {
      try {
        importString = reader.result
        console.log(JSON.parse(importString))
      } catch (err) {
        window.alert('no valid json supplied')
      }
    }
    reader.readAsText(input.files[0])
  }

  // DIRECTORIES
  // SETTINGS
  if (window.location.pathname.includes('uconfig.php')) {
    console.log('adding UI to settings...')
    const favsel = select('#favsel')
    // add list inputs
    {
      const template = favsel.lastElementChild.cloneNode(true)
      template.querySelector('.i').title = 'unlimited favorites'

      favsel.previousElementSibling.insertAdjacentHTML('beforeend',
        `<br><br>
        <b>Unlimited favorites:</b><br>
        Write into the last input to create a <b>new list</b><br>
        Click outside the text inputs to <b>save</b> your modifications!`)
      _ULF.dict.lists.forEach((list, index) => {
        favsel.appendChild(newInput(list.name, list.id, template, index))
      })
      favsel.appendChild(newInput('', _ULF.newID(), template, _ULF.counter, true))
    }

    // add buttons
    {
      const template = select('#apply').firstElementChild.cloneNode(true)
      template.removeAttribute('id')
      template.type = 'button'
      template.classList.add('ulf')

      const btnFileExport = template.cloneNode(true)
      const btnFileImport = template.cloneNode(true)
      const btnFakeFileImport = template.cloneNode(true)
      const btnImport = template.cloneNode(true)
      const btnClear = template.cloneNode(true)
    
      /*
      btnFileImport.style.padding = '2px 33px 2px'
      btnFileImport.style.margin = '0'
      btnFileExport.style.padding = '2px 33px 2px'
      btnFileExport.style.margin = '0'
      */

      btnImport.value = 'import favs'
      btnImport.setAttribute('for', 'ulf_import_json')
      btnImport.onclick = event => clickImport(event.srcElement)

      btnClear.value = 'delete all'
      btnClear.onclick = () => clearFavs()

      btnFileImport.type = 'file'
      btnFileImport.setAttribute('accept', '.json,application/json')
      btnFileImport.id = 'ulf_import_json'
      btnFileImport.style.display = 'none'
      btnFileImport.onchange = event => clickFileImport(event.srcElement)

      btnFakeFileImport.type = 'button'
      btnFakeFileImport.value = 'select file'
      btnFakeFileImport.id = 'ulf_import_button'
      btnFakeFileImport.onclick = () => select('#ulf_import_json').click()

      btnFileExport.name = 'ulf_export'
      btnFileExport.value = 'export favs'
      btnFileExport.onclick = () => {
        const fileName = 'unl_favs_' + new Date().toISOString() + '.json'
        download(JSON.stringify(_ULF.json), fileName, 'text/json')
      }

      const importBox = parser('<div id="ulf_import_box"></div>')
      importBox.append(btnFakeFileImport)
      importBox.append(btnFileImport)
      importBox.append(btnImport)
      importBox.append(btnFileExport)
      importBox.append(btnClear)
      favsel.parentElement.appendChild(importBox)
    }
  }
})()

GM_addStyle(`* {
    .ulf_import_box {
        width: 250px;
    } 
    .ulf_import_box > input {
        width: 100%
    }
}`)
