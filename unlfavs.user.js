// ==UserScript==
// @name           dev unlimited favs
// @namespace      mail@zera.tax
// @author         ZerataX
// @description    Adds unlimited local favorite lists to sadpanda
// @homepage       https://github.com/ZerataX/unlimted_favorites/
// @homepageURL    https://github.com/ZerataX/unlimted_favorites/
// @supportURL     https://github.com/ZerataX/unlimted_favorites/issues/
// @license        UNLICENSE
// @include        /^https://e(x|-)hentai\.org/.*$/
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_addStyle
// @version        0.8.0
// ==/UserScript==
/* global GM_setValue GM_getValue GM_info GM_addStyle, selected, popUp */

(async function () {
  // CONSTANTS
  const domain = window.location.hostname
  const imageDomain = (domain === 'exhentai.org') ? 'https://exhentai.org/img' : 'https://ehgt.org/g'
  const favIcon = `background-image:url(${imageDomain}/fav.png); background-position:0px -172px`

  const select = query => window.document.querySelector(query)
  const selectAll = query => window.document.querySelectorAll(query)

  const urlParams = new URLSearchParams(window.location.search)

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
      console.debug('ULF data saved')
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

    galleries (search = false, order = 'favorited', page = 0, count = 200) {
      let galleries = this._galleries
      const index = page * count
      const tags = {
        'artist': [],
        'character': [],
        'female': [],
        'group': [],
        'language': [],
        'male': [],
        'misc': [],
        'parody': [],
        'reclass': []
      }

      if (search) {
        const tagsRE = /-?(?:([a-zA-Z]):)?(".+?\$?"|-?[\w*%?]+)/g

        let match
        while (match = tagsRE.exec(search.text)) { // eslint-disable-line no-cond-assign
          const [str, namespace, tag] = match
          let include = (str[0] !== '-')
          let restring = tag

          const regex = new RegExp(restring.replace(/"/g, '')
            .replace(/\?/g, '.')
            .replace(/_/g, '.')
            .replace(/\*/g, '.*?')
            .replace(/%/g, '.*?'), 'gi')

          switch (namespace) {
            case 'f':
              tags['female'].push({ include, regex })
              break
            case 'c':
              tags['character'].push({ include, regex })
              break
            case 'g':
              tags['group'].push({ include, regex })
              break
            case 'circle':
              tags['group'].push({ include, regex })
              break
            case 'creator':
              tags['group'].push({ include, regex })
              break
            case 'l':
              tags['language'].push({ include, regex })
              break
            case 'm':
              tags['male'].push({ include, regex })
              break
            case 'p':
              tags['parody'].push({ include, regex })
              break
            case 'series':
              tags['parody'].push({ include, regex })
              break
            case 'r':
              tags['reclass'].push({ include, regex })
              break
            case undefined:
              tags['misc'].push({ include, regex })
              break
            default:
              throw SyntaxError(`namespace '${namespace}' not supported`)
          }
        }

        console.debug(tags)
        const matcher = (string, misc = false) => {
          let status = 'ignore'
          for (const namespace in tags) {
            if (misc && namespace !== 'misc') {
              // if in misc mode skip every tag that isn't in misc namespace
              continue
            }
            tags[namespace].some(tag => {
              let searchString = string
              if (namespace !== 'misc') {
                if (string.includes(`${namespace}:`)) {
                  searchString = searchString.replace(`${namespace}:`, '')
                } else {
                  // string is not in correct namespace, skip
                  return false
                }
              }

              if (tag.regex.test(searchString)) {
                if (tag.include) {
                  // string matches included tag, possibly include
                  status = 'include'
                  return false
                } else {
                  // string matches excluded tag, completely reject
                  status = 'exclude'
                  return true
                }
              }
            })
          }

          return status
        }

        // get galleries to include
        galleries = galleries.filter(gallery => {
          let show = false
          if (search.tags) {
            if (gallery.info.tags.some(tag => matcher(tag) === 'include')) {
              show = true
            }
          }
          if (search.notes) {
            if (matcher(gallery.note, true) === 'include') {
              show = true
            }
          }
          if (search.name) {
            if ((gallery.info.title && matcher(gallery.info.title, true) === 'include') ||
              (gallery.info.title_jpn && matcher(gallery.info.title_jpn, true) === 'include')) {
              show = true
            }
          }
          return show
        })
        console.debug(`galleries after include: ${galleries.length}`)

        // now check for excludes
        galleries = galleries.filter(gallery => {
          if (search.tags) {
            return !(gallery.info.tags.some(tag => matcher(tag) === 'exclude'))
          }
          if (search.notes) {
            return !(matcher(gallery.note, true) === 'exclude')
          }
          if (search.name) {
            return !((gallery.info.title && matcher(gallery.info.title, true) === 'exclude') ||
              (gallery.info.title_jpn && matcher(gallery.info.title_jpn, true) === 'exclude'))
          }
          return true
        })
        console.debug(`galleries after exclude: ${galleries.length}`)

        console.debug(galleries)
      }

      switch (order) {
        case 'favorited':
          galleries.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp)
          })
          break
        case 'posted':
          galleries.sort((a, b) => {
            // unix to date: new Date(UNIX_timestamp * 1000);
            return b.info.posted - a.info.posted
          })
          break
        default:
          throw SyntaxError('"order" has to be either "posted" or "favorited"')
      }

      return {
        'galleries': galleries.slice(index, index + count) || null,
        'number': galleries.length || 0,
        'tags': tags
      }
    }

    getGallery (id) {
      return this._galleries.find(gallery => gallery.id === parseInt(id))
    }

    removeGallery (id) {
      this._galleries = this._galleries.filter(gallery => gallery.id !== parseInt(id))
    }

    addGallery (id, token, note = '') {
      return new Promise((resolve, reject) => {
        if (!this.getGallery(id)) {
          try {
            const gallery = new Gallery(id, token, note)
            getGalleryInfo([gallery]).then(info => {
              gallery.info = info[0]
              this._galleries.push(gallery)
              resolve('gallery added!')
            })
          } catch (error) {
            // window.InternalError('could not get gallery info!')
            reject(window.InternalError('could not get gallery info!'))
          }
        } else {
          // window.Error('already added to this list!')
          reject(window.Error('already added to this list!'))
        }
      })
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
    constructor (id, token, note = '', timestamp = new Date(), info = false) {
      this._id = parseInt(id)
      this._token = token
      this._note = note
      this._timestamp = timestamp
      this._info = info
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

    get id () { return this._id }
    get token () { return this._token }
    get note () { return this._note }
    get timestamp () { return this._timestamp }
    get info () { return this._info }
    set info (info) { this._info = info }
  }

  // FUNCTIONS
  function parser (html) {
    const template = document.createElement('template')
    template.innerHTML = html
    return template.content.firstChild
  }

  // SCRIPT INITIALIZATION
  function createLists () {
    const lists = _ULF.json.lists.map(list => {
      _ULF.counter++
      return new FavList(list.name,
        list.id,
        list.galleries.map(gallery => new Gallery(gallery.gid,
          gallery.gt,
          gallery.note,
          gallery.timestamp,
          gallery.info)))
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
        name: 'Favorites 11',
        id: '_' + Math.random().toString(36).substr(2, 9),
        galleries: []
      }],
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
      delete GMJSON.display
      delete GMJSON.order
    }

    // update version
    GMJSON.version = GM_info.script.version

    return GMJSON
  }

  // SADPANDA API
  function handleErrors (response) {
    if (!response.ok || response.statux === 200) {
      throw Error(response.statusText)
    }
    return response
  }

  async function getGalleryInfo (galleries) {
    // [' + id +', "' + token + '" ]
    const request = new window.Request('https://e-hentai.org/api.php',
      {
        method: 'POST',
        body: JSON.stringify({
          'method': 'gdata',
          'gidlist': galleries.map(gallery => [parseInt(gallery.id), gallery.token]),
          'namespace': 1
        })
      })
    return window.fetch(request)
      .then(handleErrors)
      .then(response => response.json())
      .then(json => json.gmetadata)
      .catch(error => {
        console.error(error)
      })
  }

  Promise.eachLimit = async (funcs, limit, ms) => {
    let rest = funcs.slice(limit)
    await Promise.all(funcs.slice(0, limit).map(async func => {
      await func()
      while (rest.length) {
        try {
          await sleep(ms).then(() => rest.shift()())
        } catch (TypeError) {}
      }
    }))
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

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

  // UI-MODIFICATIONS
  // create list name input to rename/delete/add list
  function getLargeThumbnail (url) {
    // from: https://ehgt.org/ec/d6/ecd610aa9bc328660cdedfb7ba0200b80962e3b6-3994778-805-1240-png_l.jpg
    // to: //ehgt.org/t/ec/d6/ecd610aa9bc328660cdedfb7ba0200b80962e3b6-3994778-805-1240-png_250.jpg

    // from: https://exhentai.org/t/8b/d3/8bd3813abf795a744596201ddd7bb162ec95a86d-4438498-2400-3300-jpg_l.jpg
    // to: //ehgt.org/t/8b/d3/8bd3813abf795a744596201ddd7bb162ec95a86d-4438498-2400-3300-jpg_250.jpg

    return '//ehgt.org//t/' + url.split('/').slice(3).join('/').replace('_l', '_250')
  }

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

  function newItem (list, template, checked) {
    const selection = template.cloneNode(true)
    const counterDIV = selection.firstElementChild
    const nameDIV = selection.lastElementChild

    counterDIV.innerHTML = list._galleries.length
    nameDIV.innerHTML = list.name
    selection.onclick = () => { window.document.location = `/favorites.php?favcat=0&page=0&lid=${list.id}&ulfpage=0` }
    selection.querySelector('.i').style.filter = `invert(100%) hue-rotate(${inputcounter * 35}deg)`
    if (checked) {
      selection.classList.add('fps')
    }
    inputcounter++

    return selection
  }

  function newExtended (gallery, template) {
    const selection = template.cloneNode(true)
    const image = selection.querySelector('img')
    const title = selection.querySelector('.glink')
    const category = selection.querySelector('.gl3e')
    const categoryTitle = category.children[0]
    const dateUploaded = category.children[1]
    const rating = category.children[2]
    const uploader = category.children[3].firstElementChild
    const pageCounter = category.children[4]
    const torrent = category.children[5]
    const dateFavorited = category.children[6].lastElementChild
    const tagsSection = selection.querySelector('.gl3e').nextElementSibling

    image.src = getLargeThumbnail(gallery.info.thumb)
    image.alt = gallery.info.title || gallery.info.title_jpn
    image.title = gallery.info.title || gallery.info.title_jpn
    title.innerHTML = gallery.info.title || gallery.info.title_jpn
    dateUploaded.innerHTML = timeConverter(gallery.info.posted)
    dateUploaded.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    uploader.href = `uploader/${gallery.info.uploader}`
    uploader.innerHTML = gallery.info.uploader
    pageCounter.innerHTML = gallery.info.filecount
    dateFavorited.innerHTML = timeConverter(new Date(gallery.timestamp).getTime() / 1000)
    categoryTitle.innerHTML = gallery.info.category
    if ('torrents' in gallery.info && gallery.info.torrents.length) {
      torrent.innerHTML = `<a href="/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}"` +
      `onclick="return popUp('/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}', 610, 590)" rel="nofollow">` +
      '<img src="https://exhentai.org/img/t.png" alt="T" title="Show torrents"></a>'
    } else {
      torrent.innerHTML = '<img src="https://exhentai.org/img/td.png" alt="T" title="No torrents available">'
    }

    // not entirely correct
    const ratingOffset = [0, 0]
    ratingOffset[1] = (80 - Math.round(gallery.info.rating) * 16) * -1
    if ((Math.round(gallery.info.rating) - Math.floor(gallery.info.rating)) === 0) {
      ratingOffset[0] = -20
      ratingOffset[1] += 16
    }
    rating.style = `background-position:${ratingOffset[1]}px ${ratingOffset[0]}px;opacity:1`

    switch (gallery.info.category) {
      case 'Misc':
        categoryTitle.className = 'cn ct1'
        break
      case 'Doujinshi':
        categoryTitle.className = 'cn ct2'
        break
      case 'Manga':
        categoryTitle.className = 'cn ct3'
        break
      case 'Artist CG':
        categoryTitle.className = 'cn ct4'
        break
      case 'Artist CG Sets':
        categoryTitle.className = 'cn ct4'
        break
      case 'Game CG':
        categoryTitle.className = 'cn ct5'
        break
      case 'Image Set':
        categoryTitle.className = 'cn ct6'
        break
      case 'Cosplay':
        categoryTitle.className = 'cn ct7'
        break
      case 'Asian Porn':
        categoryTitle.className = 'cn ct8'
        break
      case 'Non-H':
        categoryTitle.className = 'cn ct9'
        break
      case 'Western':
        categoryTitle.className = 'cn cta'
        break
      default:
        throw window.InternalError(`category type '${gallery.info.category}' not supported!`)
    }

    // add tags
    const entryPoint = tagsSection.querySelector('tbody')
    entryPoint.innerHTML = ''
    const tagsCategorized = {}
    gallery.info.tags.forEach(tag => {
      const [category, name] = (tag.includes(':')) ? tag.split(':') : ['misc', tag]
      if (!(category in tagsCategorized)) {
        tagsCategorized[category] = []
      }
      tagsCategorized[category].push(name)
    })
    for (const category in tagsCategorized) {
      const categoryTR = parser(`<tr></tr>`)
      const categoryTD = parser(`<td></td>`)
      entryPoint.appendChild(categoryTR)
      categoryTR.appendChild(parser(`<td class="tc">${category}:</td>`))
      categoryTR.appendChild(categoryTD)
      tagsCategorized[category].forEach(name => {
        categoryTD.appendChild(parser(`<div class="gt" title="${category}:${name}">${name}</div>`))
      })
    }

    // change links
    const url = `/g/${gallery.id}/${gallery.token}/`
    selection.querySelector('a').href = url
    tagsSection.href = url

    return selection
  }

  // BUTTON FUNCTIONS
  const changeOrder = order => {
    const request = new window.Request(`/favorites.php?inline_set=fs_${(order === 'favorited') ? 'p' : 'f'}`)
    window.fetch(request).then(() => window.location.reload())
  }

  const changeMode = mode => {
    const request = new window.Request(`/favorites.php?inline_set=dm_${mode}`)
    window.fetch(request).then(() => window.location.reload())
  }

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
        if (_ULF.dict.getListByLid(id).galleries().number) {
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
  // FAVORITES PAGE
  if (window.location.pathname.includes('favorites.php')) {
    const page = parseInt(urlParams.get('ulfpage'))
    const lid = urlParams.get('lid')
    const parent = select('h1 + .nosel')
    const template = parent.children[9].cloneNode(true)
    const sorter = select('.ido').children[3].firstElementChild
    const order = sorter.innerText.split(' ')[1].trim().toLowerCase()
    const mode = select('select')
    const searchBox = select('input[name=f_search]')
    const searchButton = select('input[type=submit]')
    const [nameCheck, tagsCheck, noteCheck] = selectAll('input[type=checkbox')
    const pageSelections = [select('.ptt tr'), select('.ptb tr')]
    const sum = select('.ip')
    const count = 200

    if (lid) {
      const list = _ULF.dict.getListByLid(lid)
      // select current list item
      const children = [...parent.children]
      children.forEach(item => {
        item.classList.remove('fps')
      })
      // remove search button
      searchButton.remove()

      // TODO: disable search enter

      // change use posted/favorited order links
      const orderLink = sorter.querySelector('a')
      orderLink.href = '#'
      orderLink.onclick = () => changeOrder(order)

      // change mode links
      mode.onchange = event => changeMode(event.srcElement.value)

      // get gallery template
      let galleryTemplate
      let galleryLocation
      switch (mode.value) {
        case 'm':
          break
        case 'p':
          break
        case 'l':
          break
        case 'e':
          galleryLocation = select('table.itg > tbody')
          galleryTemplate = galleryLocation.children[0].cloneNode(true)
          break
        case 't':
          break
        default:
          throw window.InternalError('current mode not supported, only supports ' +
            'Minimal, Minimal+, Compact, Extended, Thumbnail')
      }

      const insertGalleries = (string = false) => {
        if (string) {
          if (window.location.hash) {
            document.location = window.location.href.split('#')[0] + `#${string}`
          } else {
            document.location += `#${string}`
          }
        } else {
          document.location = window.location.href.split('#')[0] + '#'
        }
        const search = (string) ? {
          'text': string,
          'name': nameCheck.checked,
          'notes': noteCheck.checked,
          'tags': tagsCheck.checked
        } : false
        console.debug(search)
        const { galleries, number, tags } = list.galleries(search, order, page, count)
        console.debug(`adding ${number} galleries...`)

        sum.innerHTML = `Showing ${number.toLocaleString()} results`

        // adjust page selection
        pageSelections.forEach(pageSelection => {
          const pageTemplate = pageSelection.children[1].cloneNode(true)
          const pages = Math.ceil(number / count)
          pageSelection.innerHTML = ''

          // < element
          if (page === 0) {
            pageSelection.appendChild(parser('<td class="ptdd">&lt;</td>'))
          } else {
            // if out of bounds
            if ((page - 1) * count > number) {
              console.error('out of bounds')
            }
            const pageElement = pageTemplate.cloneNode(true)
            pageElement.querySelector('a').innerHTML = '<'
            pageElement.querySelector('a').href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=${page - 1}#${string}`
            pageSelection.appendChild(pageElement)
          }
          // [0-9] elements
          for (let index = 0; index < pages; index++) {
            const pageElement = pageTemplate.cloneNode(true)
            if (page !== index) {
              pageElement.onclick = event => {
                const href = event.srcElement.href || event.srcElement.firstElementChild.href
                document.location = href
              }
              pageElement.classList.remove('ptds')
            } else {
              pageElement.classList.add('ptds')
            }
            pageElement.querySelector('a').innerHTML = index + 1
            pageElement.querySelector('a').href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=${index}#${string}`
            pageSelection.appendChild(pageElement)
          }
          // > element
          if (page === pages - 1) {
            pageSelection.appendChild(parser('<td class="ptdd">&gt;</td>'))
          } else {
            pageTemplate.querySelector('a').innerHTML = '>'
            pageTemplate.querySelector('a').href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=${page + 1}#${string}`
            pageTemplate.classList.remove('ptds')
            pageSelection.appendChild(pageTemplate)
          }
        })

        // add gallery items
        galleryLocation.innerHTML = ''
        switch (mode.value) {
          case 'm':
            break
          case 'p':
            break
          case 'l':
            break
          case 'e':
            galleries.forEach(gallery => galleryLocation.append(newExtended(gallery, galleryTemplate)))
            break
          case 't':
            break
          default:
            throw window.InternalError('current mode not supported, only supports ' +
              'Minimal, Minimal+, Compact, Extended, Thumbnail')
        }
      }
      // save search in hash / reapply search from hash
      if (window.location.hash) {
        const hash = decodeURIComponent(window.location.hash.slice(1))
        searchBox.value = (hash !== 'false') ? hash : ''
        insertGalleries(searchBox.value)
      } else {
        insertGalleries()
      }

      // start a search when changing text input or categories
      searchBox.oninput = () => insertGalleries(searchBox.value)
      nameCheck.onclick = () => insertGalleries(searchBox.value)
      tagsCheck.onclick = () => insertGalleries(searchBox.value)
      noteCheck.onclick = () => insertGalleries(searchBox.value)
    }

    // insert favorite list items
    const end = parent.children[10]
    _ULF.dict.lists.forEach(list => {
      parent.insertBefore(newItem(list, template, lid === list.id, mode.value), end)
    })
  }
  // GALLERY PAGE
  if (window.location.pathname.includes('/g/')) {
    const gid = window.location.pathname.split('/')[2]
    const list = _ULF.dict.getListByGid(gid)
    // add favorite icon if gallery is in list
    if (list) {
      const offset = _ULF.dict._lists.indexOf(list)
      const favBtn = select('#gdf')

      favBtn.innerHTML = '<div style="float:left; cursor:pointer" id="fav">' +
      `<div class="i" style="background-image:url(https://exhentai.org/img/fav.png); background-position:0px -173px; margin-left:16px" title="${list.name}">` +
      `</div></div><div style="float:left">&nbsp; <a id="favoritelink" href="#" onclick="return false">${list.name}</a></div><div class="c"></div>`
      favBtn.querySelector('.i').style.filter = `invert(100%) hue-rotate(${offset * 35}deg)`
    }
  }
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
      const btnUpdate = template.cloneNode(true)

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

      btnUpdate.name = 'ulf_update'
      btnUpdate.value = 'update all'
      btnUpdate.alt = 'update information for all galleries (this may take a while)'
      btnUpdate.onclick = async () => {
        const response = window.confirm('Update all Galleries? This can take a while and possibly be destructive, consider creating a backup first!')
        const counterMax = _ULF.dict.lists.reduce((acc, cur) => (acc._galleries) ? acc._galleries.length : acc + cur._galleries.length)
        console.debug(`found ${counterMax} galleries`)

        if (response === true) {
          const limit = 25
          const parallel = 4
          let promises = []

          await _ULF.dict.lists.forEach(async list => {
            console.log(`queueing list ${list.name}`)
            const max = list._galleries.length

            for (let current = 0; current < max; current += (limit * parallel)) {
              console.log(`queueing from ${current} to ${current + limit * parallel}`)
              for (let x = 0; x < parallel; x++) {
                promises.push(async () => {
                  const slice = list._galleries.slice(current + (limit * x), current + (limit * (x + 1)))
                  if (slice.length) {
                    getGalleryInfo(slice).then(entries => {
                      entries.forEach(info => {
                        list.getGallery(info.gid).info = info
                      })
                    })
                  }
                })
              }
            }
          })
          await Promise.eachLimit(promises, parallel, 500).then(() => {
            _ULF.dict.save()
            window.alert(`updated ${counterMax} galleries!`)
          })
        }
      }

      // insert all buttons
      const importBox = parser('<div id="ulf_import_box"></div>')
      importBox.append(btnFakeFileImport)
      importBox.append(btnFileImport)
      importBox.append(btnImport)
      importBox.append(btnFileExport)
      importBox.append(btnClear)
      importBox.append(btnUpdate)
      favsel.parentElement.appendChild(importBox)
    }
  }
  // ADD FAVORITES
  if (window.location.pathname.includes('gallerypopups.php')) {
    const gid = urlParams.get('gid')
    const token = urlParams.get('t')
    const list = _ULF.dict.getListByGid(gid) || false
    let currentClick = list.id || selected
    let lastClick = currentClick
    const note = select('textarea[name=favnote]').value

    // disable apply button
    const applyBtn = select('input[name=apply]')
    const form = select('form')
    applyBtn.type = 'button'
    form.id = 'galpop_disabled'

    const submitFavs = (src) => {
      const addULF = new Promise((resolve, reject) => {
        currentClick = src.id
        if (currentClick === lastClick) {
          console.debug(`clicked already selected option, trying to perform action`)
          if (list) {
            if (currentClick === 'favdel') {
              console.debug(`removing a gallery from ULF list '${list.name}'`)
              list.removeGallery(gid)
              _ULF.dict.save()
              // window.opener.location.reload(false)
              resolve('gallery removed')
            } else if (src.hasAttribute('lid')) {
              const newList = _ULF.dict.getListByLid(src.getAttribute('lid'))
              console.debug(`moving gallery from '${list.name}' to '${newList.name}'`)
              list.removeGallery(gid)
              newList.addGallery(gid, token, note).then(response => {
                console.debug(response)
                _ULF.dict.save()
                select('#favdel').checked = true

                resolve('gallery moved')
                // don't understand why this needs to be here the
                window.opener.location.reload(false)
                form.submit()
              })
            } else {
              console.debug(`moving gallery from ULF list '${list.name}' to '${currentClick}'`)
              list.removeGallery(gid)
              _ULF.dict.save()
              // window.opener.location.reload(false)
              resolve('gallery moved')
            }
          } else {
            if (src.hasAttribute('lid')) {
              const newList = _ULF.dict.getListByLid(src.getAttribute('lid'))
              console.debug(`adding a gallery to ULF list '${newList.name}'`)
              newList.addGallery(gid, token, note).then(response => {
                console.debug(response)
                _ULF.dict.save()
                select('#favdel').checked = true
                resolve('gallery added')
                // don't understand why this needs to be here the
                window.opener.location.reload(false)
                form.submit()
              })
            } else if (currentClick === 'favdel') {
              resolve('removing a gallery from normal list')
            } else {
              resolve('adding a gallery to normal list')
            }
          }
        }
        reject('do nothing') // eslint-disable-line prefer-promise-reject-errors
      })

      // after adding gallery to list submit form
      addULF.then(response => {
        console.debug(response)
        form.submit()
      }).catch(response => {
        lastClick = currentClick
      })
    }

    let inputcounter = 0

    const newButton = (name, id, template, counter) => {
      const selection = template.cloneNode(true)
      const input = selection.firstElementChild.firstElementChild

      input.setAttribute('id', `fav${10 + counter}`)
      input.setAttribute('lid', id)
      input.value = name
      input.classList.add('ulf', 'ulf_add_gallery')
      input.onclick = event => submitFavs(event.srcElement)
      if (list && id === list.id) {
        input.checked = true
      } else {
        input.checked = false
      }

      selection.children[1].style.filter = `invert(100%) hue-rotate(${inputcounter * 35}deg)`
      selection.children[1].onclick = () => input.click()
      selection.children[2].innerHTML = name
      selection.children[2].onclick = () => input.click()
      inputcounter++

      return selection
    }

    // add ULF button
    const parent = select('.nosel')
    const template = parent.children[9].cloneNode(true)

    const children = [...parent.children]
    children.forEach(item => {
      const input = item.firstElementChild.firstElementChild
      input.onclick = event => submitFavs(event.srcElement)
    })

    if (parent.children.length === 11) {
      const deleteBtn = parent.lastElementChild
      _ULF.dict.lists.forEach((list, index) => {
        parent.insertBefore(newButton(list.name, list.id, template, index), deleteBtn)
      })
    } else {
      const deleteBtn = parser('<div style="height:25px; cursor:pointer">' +
      '<div style="float:left"><input type="radio" name="favcat" value="favdel" id="favdel" style="position:relative; top:-1px"></div>' +
      '<div style="float:left; padding-left:5px" onclick="document.getElementById(\'favdel\').click()">Remove from Favorites</div>' +
      '<div class="c"></div>' +
      '</div>')
      _ULF.dict.lists.forEach((list, index) => {
        parent.append(newButton(list.name, list.id, template, index))
      })
      parent.append(deleteBtn)
      const input = select('#favdel')
      input.onclick = event => submitFavs(event.srcElement)
    }
  }
  // MAIN PAGE
  {
    const mode = window.document.querySelector('select')
    const items = window.document.querySelectorAll('.gldown')
    // add fav highlight to gallery item
    console.debug(`changing favorite highlighting for ${items.length} galleries`)
    items.forEach(item => {
      let favButton
      switch (mode.value) {
        case 'm':
          favButton = item.parentElement.previousElementSibling.children[2]
          break
        case 'p':
          favButton = item.parentElement.previousElementSibling.children[2]
          break
        case 'l':
          favButton = item.parentElement.children[0]
          break
        case 'e':
          favButton = item.parentElement.children[1]
          break
        case 't':
          favButton = item.parentElement.previousElementSibling.children[1]
          break
        default:
          throw window.InternalError('current mode not supported, only supports ' +
            'Minimal, Minimal+, Compact, Extended, Thumbnail')
      }

      const gid = favButton.id.replace('posted_', '')
      const list = _ULF.dict.getListByGid(gid) || _ULF.dict.getListByLid(urlParams.get('lid'))
      if (list) {
        const offset = _ULF.dict._lists.indexOf(list)
        favButton.style = 'border-color: rgb(238, 136, 238); background-color: rgba(224, 128, 224, 0.1);'
        favButton.style.filter = `invert(100%) hue-rotate(${offset * 35}deg)`
      }
    })
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
