// ==UserScript==
// @name           unlimited favs
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
// @version        1.1.0
// ==/UserScript==
/* global GM_setValue GM_getValue GM_info GM_addStyle, selected, popUp, show_image_pane, hide_image_pane */

(async function () {
  // CONSTANTS
  const select = query => window.document.querySelector(query)
  const selectAll = query => window.document.querySelectorAll(query)
  const urlParams = new URLSearchParams(window.location.search)

  // Magic Numbers
  const HUEOFFSET = 75

  // GLOBALS
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
        artist: [],
        character: [],
        female: [],
        group: [],
        language: [],
        male: [],
        other: [],
        parody: [],
        reclass: []
      }

      if (search) {
        const tagsRE = /-?(?:([a-zA-Z]+):)?(".+?\$?"|-?[\w*%$?]+)/g

        let match
        while (match = tagsRE.exec(search.text)) { // eslint-disable-line no-cond-assign
          const [str, namespace, tag] = match
          const include = (str[0] !== '-')
          const regexString = tag

          const regex = new RegExp(regexString.replace(/"/g, '')
            .replace(/\?/g, '.')
            .replace(/_/g, '.')
            .replace(/\*/g, '.*?')
            .replace(/%/g, '.*?'), 'i')

          switch (namespace) {
            case 'artist':
              tags.artist.push({ include, regex })
              break
            case 'f':
              tags.female.push({ include, regex })
              break
            case 'female':
              tags.female.push({ include, regex })
              break
            case 'c':
              tags.character.push({ include, regex })
              break
            case 'character':
              tags.character.push({ include, regex })
              break
            case 'g':
              tags.group.push({ include, regex })
              break
            case 'group':
              tags.group.push({ include, regex })
              break
            case 'circle':
              tags.group.push({ include, regex })
              break
            case 'creator':
              tags.group.push({ include, regex })
              break
            case 'l':
              tags.language.push({ include, regex })
              break
            case 'language':
              tags.language.push({ include, regex })
              break
            case 'm':
              tags.male.push({ include, regex })
              break
            case 'male':
              tags.male.push({ include, regex })
              break
            case 'p':
              tags.parody.push({ include, regex })
              break
            case 'parody':
              tags.parody.push({ include, regex })
              break
            case 'series':
              tags.parody.push({ include, regex })
              break
            case 'r':
              tags.reclass.push({ include, regex })
              break
            case 'reclass':
              tags.reclass.push({ include, regex })
              break
            case 'other':
              tags.other.push({ include, regex })
              break
            case undefined:
              tags.other.push({ include, regex })
              break
            default:
              throw SyntaxError(`namespace '${namespace}' not supported`)
          }
        }
        console.debug(tags)

        const titleMatcher = (include, title, matchedTags = []) => {
          let match = false
          if (!(tags.other.length)) { return false }
          tags.other.forEach(tag => {
            if (include) {
              if (tag.include && tag.regex.test(title)) {
                matchedTags.push(tag)
                match = true
              }
            } else {
              if (!tag.include && tag.regex.test(title)) {
                matchedTags.push(tag)
                match = true
              }
            }
          })
          return match
        }

        const includeMatcher = (includeTag, includeNamespace, tags) => {
          if (!includeTag.include) { return true }
          return tags.some(tag => {
            const [namespace, name] = (tag.includes(':')) ? tag.split(':') : ['other', tag]
            if (includeNamespace === 'other' || includeNamespace === namespace) {
              return includeTag.regex.test(name)
            }
            return false
          })
        }

        // get galleries to include
        console.debug(`galleries before include: ${galleries.length}`)
        galleries = galleries.filter(gallery => {
          let show = false
          const matchedTags = [] // search tags used for notes / title should not be reused for gallery tags
          if (search.name) {
            show = (gallery.info.title && titleMatcher(true, gallery.info.title, matchedTags)) ||
              (gallery.info.title_jpn && titleMatcher(true, gallery.info.title_jpn, matchedTags))
          }
          if (search.notes) {
            show = show || titleMatcher(true, gallery.note, matchedTags)
          }
          if (search.tags) {
            for (const namespace in tags) {
              show = tags[namespace].every(tag => {
                return matchedTags.some(mTag => tag.regex === mTag.regex) ||
                  includeMatcher(tag, namespace, gallery.info.tags)
              })
              if (!show) { break }
            }
          }

          return show
        })
        console.debug(`galleries after include: ${galleries.length}`)

        const excludeMatcher = (string) => {
          const [namespace, name] = (string.includes(':')) ? string.split(':') : ['other', string]
          // check if string matches any tag in same namespace or in other namespace
          return (tags[namespace].some(tag => {
            if (tag.include) { return false }
            return tag.regex.test(name)
          })) || (tags.other.some(tag => {
            if (tag.include) { return false }
            return tag.regex.test(name)
          }))
        }

        // now check for excludes
        galleries = galleries.filter(gallery => {
          if (search.name) {
            if ((gallery.info.title && titleMatcher(false, gallery.info.title)) ||
              (gallery.info.title_jpn && titleMatcher(false, gallery.info.title_jpn))) { return false }
          }
          if (search.notes) {
            if (titleMatcher(false, gallery.note)) { return false }
          }
          if (search.tags) {
            if (gallery.info.tags.some(tag => excludeMatcher(tag))) { return false }
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
        galleries: galleries.slice(index, index + count) || null,
        number: galleries.length || 0,
        tags: tags
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
    set note (note) { this._note = note }
    get timestamp () { return this._timestamp }
    get info () { return this._info }
    set info (info) { this._info = info }
  }

  // FUNCTIONS
  function parser (html) {
    const template = document.createElement('template')
    template.innerHTML = html
    return template.content.firstElementChild
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
  saveGM()

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
    const GMString = String(importString || GM_getValue('favsJson', '') || GM_getValue('__unlimitedfavs__', ''))
    // set default if no import and no saved version
    const defaultValue = {
      lists: [{
        name: 'Favorites 11',
        id: '_' + Math.random().toString(36).substr(2, 9),
        galleries: []
      }],
      version: GM_info.script.version
    }
    try {
      const GMJSON = (GMString && GMString !== '{}') ? JSON.parse(GMString) : defaultValue
      console.debug(GMJSON)

      // VERSION ADJUSTMENTS
      if (!GMJSON.version) {
        GMJSON.version = '0.6.5'
      }

      // Allow to backup before doing any other changes to the user data
      if (versionCompare(String(GMJSON.version), GM_info.script.version) === -1) {
        // only backup on major version change
        const oldMajor = parseInt(GMJSON.version.split('.')[1])
        const newMajor = parseInt(GM_info.script.version.split('.')[1])
        if (oldMajor !== newMajor) {
          const confirmation = window.confirm(`Unlimited Favorites has been updated to version ${GM_info.script.version}, ` +
          'do you want to create a backup before updating your data?\n' +
          `see what's new here: https://github.com/ZerataX/unlimted_favorites/releases/tag/${GM_info.script.version}`)
          if (confirmation) {
            const fileName = 'unl_favs_' + new Date().toISOString() + '.json'
            download(JSON.stringify(GMJSON), fileName, 'text/json')
          }
        }
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
          list.id = '_' + Math.random().toString(36).substr(2, 9)
          for (const gallery of list.galleries) {
            gallery.timestamp = gallery.date
            delete gallery.date
          }
        }
        delete GMJSON.display
        delete GMJSON.order
      }
      if (versionCompare(String(GMJSON.version), '1.1.0') === -1) {
      // fix saved JSONs from < 1.1.0 versions
      // misc got renamed to other
        for (const list of GMJSON.lists) {
          for (const gallery of list.galleries) {
            for (const tags of gallery.info.tags) {
                const other_tags = tags.misc
                tags.other = other_tags
                delete tags.misc
            }
          }
        }
      }

      // update version
      GMJSON.version = GM_info.script.version

      // remove old save data
      GM_setValue('favsJson', '')

      return GMJSON
    } catch {
      window.alert('something went wrong trying to parse your settings, please download your settings and create an issue with them attached here: https://github.com/ZerataX/unlimted_favorites/issues/new')
      const fileName = 'unl_favs_' + new Date().toISOString() + '.json'
      download(GMString, fileName, 'text/json')
      return defaultValue
    }
  }

  // SADPANDA API
  function handleErrors (response) {
    if (!response.ok || response.status !== 200) {
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
          method: 'gdata',
          gidlist: galleries.map(gallery => [parseInt(gallery.id), gallery.token]),
          namespace: 1
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
    const rest = funcs.slice(limit)
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

  function getRatingStyle (rating) {
    // not entirely correct
    const ratingOffset = [0, 0]
    ratingOffset[1] = (80 - Math.round(rating) * 16) * -1
    if ((Math.round(rating) - Math.floor(rating)) === 0) {
      ratingOffset[0] = -20
      ratingOffset[1] += 16
    }
    return `background-position:${ratingOffset[1]}px ${ratingOffset[0]}px;opacity:1`
  }

  function getCategoryClass (category) {
    switch (category) {
      case 'other':
        return 'ct1'
      case 'Doujinshi':
        return 'ct2'
      case 'Manga':
        return 'ct3'
      case 'Artist CG':
        return 'ct4'
      case 'Artist CG Sets':
        return 'ct4'
      case 'Game CG':
        return 'ct5'
      case 'Image Set':
        return 'ct6'
      case 'Cosplay':
        return 'ct7'
      case 'Asian Porn':
        return 'ct8'
      case 'Non-H':
        return 'ct9'
      case 'Western':
        return 'cta'
      default:
        throw window.InternalError(`category type '${category}' not supported!`)
    }
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

    selection.querySelector('.i').style.filter = `invert(100%) hue-rotate(${inputcounter * HUEOFFSET}deg)`
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
    selection.querySelector('.i').style.filter = `invert(100%) hue-rotate(${inputcounter * HUEOFFSET}deg)`
    if (checked) {
      selection.classList.add('fps')
    } else {
      selection.classList.remove('fps')
    }
    inputcounter++

    return selection
  }

  function newExtended (gallery, template, tags = false) {
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
    const note = selection.querySelector('.glfnote')
    const checkbox = selection.querySelector('input[name="modifygids[]"]')

    image.src = getLargeThumbnail(gallery.info.thumb)
    image.alt = gallery.info.title || gallery.info.title_jpn
    image.title = gallery.info.title || gallery.info.title_jpn
    title.innerHTML = gallery.info.title || gallery.info.title_jpn
    dateUploaded.innerHTML = timeConverter(gallery.info.posted)
    dateUploaded.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    dateUploaded.id = `posted_${gallery.id}`
    uploader.href = `uploader/${gallery.info.uploader}`
    uploader.innerHTML = gallery.info.uploader
    pageCounter.innerHTML = gallery.info.filecount
    dateFavorited.innerHTML = timeConverter(new Date(gallery.timestamp).getTime() / 1000)
    categoryTitle.innerHTML = gallery.info.category
    categoryTitle.className = `cn ${getCategoryClass(gallery.info.category)}`
    if ('torrents' in gallery.info && gallery.info.torrents.length) {
      torrent.innerHTML = `<a href="/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}"` +
      `onclick="return popUp('/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}', 610, 590)" rel="nofollow">` +
      '<img src="https://ehgt.org/g/t.png" alt="T" title="Show torrents"></a>'
    } else {
      torrent.innerHTML = '<img src="https://ehgt.org/g/td.png" alt="T" title="No torrents available">'
    }
    note.innerHTML = (gallery.note) ? `Note: ${gallery.note}` : ''
    note.id = `favnote_${gallery.id}`
    note.style = ''
    checkbox.value = gallery.id
    rating.style = getRatingStyle(gallery.info.rating)

    // add tags
    const entryPoint = tagsSection.querySelector('tbody')
    entryPoint.innerHTML = ''
    const tagsCategorized = {}
    gallery.info.tags.forEach(tag => {
      const [namespace, name] = (tag.includes(':')) ? tag.split(':') : ['other', tag]
      if (!(namespace in tagsCategorized)) {
        tagsCategorized[namespace] = []
      }
      const highlight = tags
        ? (tags[namespace].some(matchTag => matchTag.include && matchTag.regex.test(name)) ||
        tags.other.some(matchTag => matchTag.include && matchTag.regex.test(name)))
        : false
      tagsCategorized[namespace].push({ name, highlight })
    })

    for (const category in tagsCategorized) {
      const categoryTR = parser('<tr></tr>')
      const categoryTD = parser('<td></td>')
      entryPoint.appendChild(categoryTR)
      categoryTR.appendChild(parser(`<td class="tc">${category}:</td>`))
      categoryTR.appendChild(categoryTD)
      tagsCategorized[category].forEach(tag => {
        const style = tag.highlight ? 'color:#090909;border-color:#ffbf36;background:radial-gradient(#ffbf36,#ffba00) !important' : ''
        categoryTD.appendChild(parser(`<div class="gt" style="${style}" title="${category}:${tag.name}">${tag.name}</div>`))
      })
    }

    // change links
    const url = `/g/${gallery.id}/${gallery.token}/`
    selection.querySelector('a').href = url
    tagsSection.href = url

    return selection
  }

  function newThumbnail (gallery, template, tags = false) {
    const selection = template.cloneNode(true)
    const image = selection.querySelector('img')
    const title = selection.querySelector('.glink')
    const category = selection.querySelector('.gl5t')
    const categoryTitle = category.firstElementChild.firstElementChild
    const dateUploaded = category.firstElementChild.children[1]
    const rating = category.lastElementChild.firstElementChild
    const pageCounter = category.lastElementChild.children[1]
    const torrent = category.lastElementChild.children[2]
    const tagsSection = selection.querySelector('.gl6t')
    const note = selection.querySelector('.glfnote')
    const checkbox = selection.querySelector('input[name="modifygids[]"]')

    image.src = getLargeThumbnail(gallery.info.thumb)
    image.alt = gallery.info.title || gallery.info.title_jpn
    image.title = gallery.info.title || gallery.info.title_jpn
    title.innerHTML = gallery.info.title || gallery.info.title_jpn
    dateUploaded.innerHTML = timeConverter(gallery.info.posted)
    dateUploaded.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    dateUploaded.id = `posted_${gallery.id}`
    pageCounter.innerHTML = gallery.info.filecount
    categoryTitle.innerHTML = gallery.info.category
    categoryTitle.className = `cn ${getCategoryClass(gallery.info.category)}`
    if ('torrents' in gallery.info && gallery.info.torrents.length) {
      torrent.innerHTML = `<a href="/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}"` +
      `onclick="return popUp('/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}', 610, 590)" rel="nofollow">` +
      '<img src="https://exhentai.org/img/t.png" alt="T" title="Show torrents"></a>'
    } else {
      torrent.innerHTML = '<img src="https://exhentai.org/img/td.png" alt="T" title="No torrents available">'
    }
    note.innerHTML = (gallery.note) ? `Note: ${gallery.note}` : ''
    note.id = `favnote_${gallery.id}`
    note.style = ''
    checkbox.value = gallery.id
    rating.style = getRatingStyle(gallery.info.rating)

    // add tags
    tagsSection.innerHTML = ''
    const tagsCategorized = {
      female: [],
      artist: [],
      male: [],
      character: [],
      group: [],
      language: [],
      other: [],
      parody: [],
      reclass: []
    }
    gallery.info.tags.forEach(tag => {
      const [namespace, name] = (tag.includes(':')) ? tag.split(':') : ['other', tag]
      const highlight = tags
        ? (tags[namespace].some(matchTag => matchTag.include && matchTag.regex.test(name)) ||
        tags.other.some(matchTag => matchTag.include && matchTag.regex.test(name)))
        : false
      tagsCategorized[namespace].push({ name, highlight })
    })

    let index = 0
    for (const category in tagsCategorized) {
      tagsCategorized[category].forEach(tag => {
        const style = 'color:#090909;border-color:#b58411c9;background:radial-gradient(#ffbf36,#ffba00);' +
         `filter: hue-rotate(${index * HUEOFFSET}deg);`
        if (tag.highlight) {
          tagsSection.appendChild(parser(`<div class="gt" style="${style}" title="${category}:${tag.name}">${tag.name}</div>`))
        }
      })
      index++
    }

    // change links
    const url = `/g/${gallery.id}/${gallery.token}/`
    selection.querySelector('a').href = url
    image.parentElement.href = url

    return selection
  }

  function newCompact (gallery, template, offset, tags = false) {
    const selection = template.cloneNode(true)
    const pane = selection.querySelector('.glthumb')
    const paneImage = pane.querySelector('img')
    const paneInfo = pane.lastElementChild
    const paneCategoryTitle = paneInfo.firstElementChild.firstElementChild
    const paneDate = paneInfo.firstElementChild.lastElementChild
    const paneRating = paneInfo.lastElementChild.firstElementChild
    const panePages = paneInfo.lastElementChild.lastElementChild
    const categoryTitle = selection.querySelector('.glcat').firstElementChild
    const glcut = selection.querySelector('.glcut')
    const userInfo = selection.querySelector('.gl2c').lastElementChild
    const dateUploaded = userInfo.children[0]
    const rating = userInfo.children[1]
    const torrent = userInfo.children[2]
    const info = selection.querySelector('.glname')
    const title = info.firstElementChild.children[0]
    const tagsSection = info.firstElementChild.children[1]
    const note = info.firstElementChild.children[2]
    const dateFaved = selection.querySelector('.glfav')
    const checkbox = selection.querySelector('input[name="modifygids[]"]')

    info.onmouseover = () => show_image_pane(gallery.id)
    info.onmouseout = () => hide_image_pane(gallery.id)
    title.innerHTML = gallery.info.title || gallery.info.title_jpn
    glcut.id = `ic${gallery.id}`
    pane.id = `it${gallery.id}`
    paneImage.src = getLargeThumbnail(gallery.info.thumb)
    paneImage.alt = gallery.info.title || gallery.info.title_jpn
    paneImage.title = gallery.info.title || gallery.info.title_jpn
    paneCategoryTitle.innerHTML = gallery.info.category
    paneCategoryTitle.className = `cn ${getCategoryClass(gallery.info.category)}`
    paneCategoryTitle.id = `postedpop_${gallery.id}`
    paneDate.innerHTML = timeConverter(gallery.info.posted)
    paneDate.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    paneDate.id = `posted_${gallery.id}`
    paneDate.style = 'border-color: rgb(238, 136, 238); background-color: rgba(224, 128, 224, 0.1);'
    paneDate.style.filter = `invert(100%) hue-rotate(${offset * HUEOFFSET}deg)`
    paneRating.style = getRatingStyle(gallery.info.rating)
    panePages.innerHTML = gallery.info.filecount
    dateUploaded.innerHTML = timeConverter(gallery.info.posted)
    dateUploaded.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    dateUploaded.id = `posted_${gallery.id}`
    dateFaved.innerHTML = timeConverter(new Date(gallery.timestamp).getTime() / 1000).replace(' ', '<br>')
    categoryTitle.innerHTML = gallery.info.category
    categoryTitle.className = `cn ${getCategoryClass(gallery.info.category)}`
    if ('torrents' in gallery.info && gallery.info.torrents.length) {
      torrent.innerHTML = `<a href="/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}"` +
      `onclick="return popUp('/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}', 610, 590)" rel="nofollow">` +
      '<img src="https://exhentai.org/img/t.png" alt="T" title="Show torrents"></a>'
    } else {
      torrent.innerHTML = '<img src="https://exhentai.org/img/td.png" alt="T" title="No torrents available">'
    }
    note.innerHTML = (gallery.note) ? `Note: ${gallery.note}` : ''
    note.id = `favnote_${gallery.id}`
    note.style = ''
    checkbox.value = gallery.id
    rating.style = getRatingStyle(gallery.info.rating)

    // add tags
    tagsSection.innerHTML = ''
    const tagsCategorized = {
      female: [],
      artist: [],
      male: [],
      character: [],
      group: [],
      language: [],
      other: [],
      parody: [],
      reclass: []
    }
    gallery.info.tags.forEach(tag => {
      const [namespace, name] = (tag.includes(':')) ? tag.split(':') : ['other', tag]
      const highlight = tags
        ? (tags[namespace].some(matchTag => matchTag.include && matchTag.regex.test(name)) ||
        tags.other.some(matchTag => matchTag.include && matchTag.regex.test(name)))
        : false
      if (highlight) {
        tagsCategorized[namespace].unshift({ name, highlight })
      } else {
        tagsCategorized[namespace].push({ name, highlight })
      }
    })

    let count = 0
    for (const category in tagsCategorized) {
      tagsCategorized[category].some(tag => {
        const style = (tag.highlight) ? 'color:#090909;border-color:#b58411c9;background:radial-gradient(#ffbf36,#ffba00);' : ''
        tagsSection.appendChild(parser(`<div class="gt" style="${style}" title="${category}:${tag.name}">${tag.name}</div>`))
        count++
        return count > 8
      })
      if (count > 8) { break }
    }

    // change links
    const url = `/g/${gallery.id}/${gallery.token}/`
    title.parentElement.href = url
    // image.parentElement.href = url

    return selection
  }

  function newMinimal (gallery, template, offset, tags = false) {
    const selection = template.cloneNode(true)
    const pane = selection.querySelector('.glthumb')
    const paneImage = pane.querySelector('img')
    const paneInfo = pane.lastElementChild
    const paneCategoryTitle = paneInfo.firstElementChild.firstElementChild
    const paneDate = paneInfo.firstElementChild.lastElementChild
    const paneRating = paneInfo.lastElementChild.firstElementChild
    const panePages = paneInfo.lastElementChild.lastElementChild
    const categoryTitle = selection.querySelector('.glcat').firstElementChild
    const glcut = selection.querySelector('.glcut')
    const dateUploaded = selection.querySelector('.gl2m').children[2]
    const rating = selection.querySelector('.gl4m').firstElementChild
    const torrent = selection.querySelector('.gldown')
    const info = selection.querySelector('.glname')
    const title = info.firstElementChild.children[0]
    const tagsSection = info.firstElementChild.children[1]
    // if no tags the note section is at the position of the tagsection
    const note = (tags) ? info.firstElementChild.children[2] : tagsSection
    const dateFaved = selection.querySelector('.glfav')
    const checkbox = selection.querySelector('input[name="modifygids[]"]')

    info.onmouseover = () => show_image_pane(gallery.id)
    info.onmouseout = () => hide_image_pane(gallery.id)
    title.innerHTML = gallery.info.title || gallery.info.title_jpn
    glcut.id = `ic${gallery.id}`
    pane.id = `it${gallery.id}`
    paneImage.src = getLargeThumbnail(gallery.info.thumb)
    paneImage.alt = gallery.info.title || gallery.info.title_jpn
    paneImage.title = gallery.info.title || gallery.info.title_jpn
    paneCategoryTitle.innerHTML = gallery.info.category
    paneCategoryTitle.className = `cn ${getCategoryClass(gallery.info.category)}`
    paneCategoryTitle.id = `postedpop_${gallery.id}`
    paneDate.innerHTML = timeConverter(gallery.info.posted)
    paneDate.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    paneDate.id = `posted_${gallery.id}`
    paneDate.style = 'border-color: rgb(238, 136, 238); background-color: rgba(224, 128, 224, 0.1);'
    paneDate.style.filter = `invert(100%) hue-rotate(${offset * HUEOFFSET}deg)`
    paneRating.style = getRatingStyle(gallery.info.rating)
    panePages.innerHTML = gallery.info.filecount
    dateUploaded.innerHTML = timeConverter(gallery.info.posted)
    dateUploaded.onclick = () => popUp(`/gallerypopups.php?gid=${gallery.id}&t=${gallery.token}&act=addfav`, 675, 415)
    dateUploaded.id = `posted_${gallery.id}`
    dateFaved.innerHTML = timeConverter(new Date(gallery.timestamp).getTime() / 1000)
    categoryTitle.innerHTML = gallery.info.category
    categoryTitle.className = `cs ${getCategoryClass(gallery.info.category)}`
    if ('torrents' in gallery.info && gallery.info.torrents.length) {
      torrent.innerHTML = `<a href="/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}"` +
      `onclick="return popUp('/gallerytorrents.php?gid=${gallery.id}&t=${gallery.token}', 610, 590)" rel="nofollow">` +
      '<img src="https://exhentai.org/img/t.png" alt="T" title="Show torrents"></a>'
    } else {
      torrent.innerHTML = '<img src="https://exhentai.org/img/td.png" alt="T" title="No torrents available">'
    }
    note.innerHTML = (gallery.note) ? `Note: ${gallery.note}` : ''
    note.id = `favnote_${gallery.id}`
    note.style = ''
    checkbox.value = gallery.id
    rating.style = getRatingStyle(gallery.info.rating)

    // add tags
    tagsSection.innerHTML = ''
    const tagsCategorized = {
      female: [],
      artist: [],
      male: [],
      character: [],
      group: [],
      language: [],
      other: [],
      parody: [],
      reclass: []
    }
    gallery.info.tags.forEach(tag => {
      const [namespace, name] = (tag.includes(':')) ? tag.split(':') : ['other', tag]
      const highlight = tags
        ? (tags[namespace].some(matchTag => matchTag.include && matchTag.regex.test(name)) ||
        tags.other.some(matchTag => matchTag.include && matchTag.regex.test(name)))
        : false
      if (highlight) {
        tagsCategorized[namespace].unshift({ name, highlight })
      } else {
        tagsCategorized[namespace].push({ name, highlight })
      }
    })

    let count = 0
    for (const category in tagsCategorized) {
      tagsCategorized[category].some(tag => {
        const style = (tag.highlight) ? 'color:#090909;border-color:#b58411c9;background:radial-gradient(#ffbf36,#ffba00);' : ''
        tagsSection.appendChild(parser(`<div class="gt" style="${style}" title="${category}:${tag.name}">${tag.name}</div>`))
        count++
        return count > 5
      })
      if (count > 5) { break }
    }

    // change links
    const url = `/g/${gallery.id}/${gallery.token}/`
    title.parentElement.href = url
    // image.parentElement.href = url

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
    const reader = new window.FileReader()
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
    const order = select('.searchnav').firstElementChild.firstElementChild
    const mode = select('.searchnav').lastElementChild.firstElementChild
    const searchForm = select('form')
    const searchBox = select('input[name=f_search]')
    console.debug(searchBox)
    const searchButton = select('input[type=submit]')
    // const [nameCheck, tagsCheck, noteCheck] = selectAll('input[type=checkbox')
    const sum = select('.ip')
    const count = 200

    if (lid) {
      const list = _ULF.dict.getListByLid(lid)
      const offset = _ULF.dict._lists.indexOf(list)
      // select current list item
      const children = [...parent.children]
      children.forEach(item => {
        item.classList.remove('fps')
      })
      // modify search button
      searchForm.onkeydown = (event) => {
        const x = event.which
        if (x === 13) {
          event.preventDefault()
          insertGalleries(searchBox.value)
        }
      }
      searchButton.type = 'button'
      searchButton.onclick = () => insertGalleries(searchBox.value)

      // TODO: disable search enter

      // change use posted/favorited order links
      order.onchange = event => changeOrder(event.srcElement.value)

      // change mode links
      mode.onchange = event => changeMode(event.srcElement.value)

      // get gallery template
      let galleryTemplate
      let galleryLocation
      switch (mode.value) {
        case 'm':
          galleryLocation = select('table.itg > tbody')
          galleryTemplate = galleryLocation.children[1].cloneNode(true)
          break
        case 'p':
          galleryLocation = select('table.itg > tbody')
          galleryTemplate = galleryLocation.children[1].cloneNode(true)
          break
        case 'l':
          galleryLocation = select('table.itg > tbody')
          galleryTemplate = galleryLocation.children[1].cloneNode(true)
          break
        case 'e':
          galleryLocation = select('table.itg > tbody')
          galleryTemplate = galleryLocation.firstElementChild.cloneNode(true)
          break
        case 't':
          galleryLocation = select('.itg.gld')
          galleryTemplate = galleryLocation.firstElementChild.cloneNode(true)
          break
        default:
          throw window.InternalError('current mode not supported, only supports ' +
            'Minimal, Minimal+, Compact, Extended, Thumbnail')
      }

      const insertGalleries = (string = false) => {
        if (string) {
          if (window.location.hash) {
            document.location = window.location.href.split('#')[0] + `#${encodeURIComponent(string)}`
          } else {
            document.location += `#${encodeURIComponent(string)}`
          }
        } else {
          document.location = window.location.href.split('#')[0] + '#'
        }
        const search = (string)
          ? {
              text: string,
              name: true,
              notes: true,
              tags: true
            }
          : false
        console.debug(search || 'no search')
        const { galleries, number, tags } = list.galleries(search, order.value === 'f' ? 'favorited' : 'posted', page, count)
        console.debug(`found ${number} galleries`)

        // adjust page selection
        const pages = Math.ceil(number / count) || 1
        console.debug(`showing page ${page+1} of ${pages}`)
        const positions = ['u', 'd']
        const actions = ['first', 'prev', 'jump', 'next', 'last']
        positions.forEach(position => {
            actions.forEach(action => {
                let actionText = ''
                switch(action) {
                    case 'first':
                      actionText = '<< First'
                      break
                    case 'prev':
                      actionText = '< Previous'
                      break
                    case 'jump':
                        actionText = 'Jump'
                        break
                    case 'next':
                      actionText = 'Next >'
                      break
                    case 'last':
                      actionText = 'Last >>'
                      break
                    default:
                        break
                }
                const actionID = `${position}${action}`
                const button = select(`#${actionID}`)
                const span = document.createElement("span");
                span.innerText = actionText
                span.id = actionID
                const link = document.createElement("a");
                link.innerText = actionText
                link.id = actionID
                switch (action) {
                    case 'first':
                        if ( page !== 0 ) {
                            link.href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=0#${encodeURIComponent(string)}`
                            button.replaceWith(link)
                        } else {
                            button.replaceWith(span)
                        }
                        break
                    case 'previous':
                        if ( page !== 0 ) {
                            link.href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=${page - 1}#${encodeURIComponent(string)}`
                            button.replaceWith(link)
                        } else {
                            button.replaceWith(span)
                        }
                        break
                    case 'jump':
                        if ( pages > 0 ) {
                            // jump selector
                            button.replaceWith(span)
                        } else {
                            button.replaceWith(span)
                        }
                        break
                    case 'next':
                        if ( page !== pages - 1 ) {
                            link.href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=${page + 1}#${encodeURIComponent(string)}`
                            button.replaceWith(link)
                        } else {
                            button.replaceWith(span)
                        }
                        break
                    case 'last':
                        if ( page !== pages - 1 ) {
                            link.href = `/favorites.php?page=1&favcat=0&lid=${lid}&ulfpage=${pages - 1}#${encodeURIComponent(string)}`
                            button.replaceWith(link)
                        } else {
                            button.replaceWith(span)
                        }
                        break
                }
            })
        })

        // add gallery items
        galleryLocation.innerHTML = ''
        let firstRow = ''
        switch (mode.value) {
          case 'm':
            firstRow = parser('<tr><th></th><th>Published</th><th></th><th>Title</th><th></th><th colspan="2">Favorited</th></tr>')
            galleryLocation.append(firstRow)
            galleries.forEach(gallery => galleryLocation.append(newMinimal(gallery, galleryTemplate, offset)))
            break
          case 'p':
            firstRow = parser('<tr><th></th><th>Published</th><th></th><th>Title</th><th></th><th colspan="2">Favorited</th></tr>')
            galleryLocation.append(firstRow)
            galleries.forEach(gallery => galleryLocation.append(newMinimal(gallery, galleryTemplate, offset, tags)))
            break
          case 'l':
            firstRow = parser('<tr><th></th><th>Published</th><th>Title</th><th colspan="2">Favorited</th></tr>')
            galleryLocation.append(firstRow)
            galleries.forEach(gallery => galleryLocation.append(newCompact(gallery, galleryTemplate, offset, tags)))
            break
          case 'e':
            galleries.forEach(gallery => galleryLocation.append(newExtended(gallery, galleryTemplate, tags)))
            break
          case 't':
            galleries.forEach(gallery => galleryLocation.append(newThumbnail(gallery, galleryTemplate, tags)))
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
        console.debug(searchBox.value)
        insertGalleries(searchBox.value)
      } else {
        insertGalleries()
      }

      // start a search when changing text input or categories
      searchBox.onchange = () => insertGalleries(searchBox.value)
      // searchBox.oninput = () => {
      //   let location = window.location.href.split('#')[0]
      //   searchForm.action = `${location}#${searchBox.value}`
      // }
      // nameCheck.onclick = () => insertGalleries(searchBox.value)
      // tagsCheck.onclick = () => insertGalleries(searchBox.value)
      // noteCheck.onclick = () => insertGalleries(searchBox.value)
    }

    // insert favorite list items
    const end = parent.children[10]
    _ULF.dict.lists.forEach(list => {
      parent.insertBefore(newItem(list, template, lid === list.id, mode.value), end)
    })
  }
  // GALLERY PAGE
  if (window.location.pathname.includes('/g/')) {
    const [id, token] = window.location.pathname.split('/').slice(2)
    const list = _ULF.dict.getListByGid(id)

    // add favorite icon if gallery is in list
    if (list) {
      const offset = _ULF.dict._lists.indexOf(list)
      const favBtn = select('#gdf')

      // dumb gallery info
      console.debug(list.getGallery(id))

      favBtn.innerHTML = '<div style="float:left; cursor:pointer" id="fav">' +
      `<div class="i" style="background-image:url(https://exhentai.org/img/fav.png); background-position:0px -173px; margin-left:16px" title="${list.name}">` +
      `</div></div><div style="float:left">&nbsp; <a id="favoritelink" href="#" onclick="return false">${list.name}</a></div><div class="c"></div>`
      favBtn.querySelector('.i').style.filter = `invert(100%) hue-rotate(${offset * HUEOFFSET}deg)`
    } else {
      // dumb gallery info
      const gallery = { id, token }
      getGalleryInfo([gallery]).then(info => console.debug(info[0]))
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
      btnClear.onclick = () => {
        if (window.confirm('delete all list? this action can\'t be undone!')) {
          clearFavs()
        }
      }

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
          const promises = []

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
    const note = select('textarea[name=favnote]')

    if (list) {
      const gallery = list.getGallery(gid)
      note.value = gallery.note
    }

    // disable apply button
    const applyBtn = select('input[name=apply]')
    const form = select('form')
    applyBtn.type = 'button'
    form.id = 'galpop_disabled'

    const submitFavs = (src, apply = false) => {
      const addULF = new Promise((resolve, reject) => {
        currentClick = src.id
        if (currentClick === lastClick || apply === true) {
          console.debug('clicked already selected option, trying to perform action')
          if (list) {
            if (currentClick === 'favdel') {
              console.debug(`removing a gallery from ULF list '${list.name}'`)
              list.removeGallery(gid)
              _ULF.dict.save()
              // window.opener.location.reload(false)
              resolve('gallery removed')
            } else if (src.hasAttribute('lid')) {
              const newList = _ULF.dict.getListByLid(src.getAttribute('lid'))
              if (list === newList) {
                console.debug('updating gallery info')
                const gallery = list.getGallery(gid)
                gallery.note = note.value
                _ULF.dict.save()
                select('#favdel').checked = true

                resolve('gallery updated')
                // don't understand why this needs to be here
                window.opener.location.reload(false)
                form.submit()
              } else {
                console.debug(`moving gallery from '${list.name}' to '${newList.name}'`)
                list.removeGallery(gid)
                newList.addGallery(gid, token, note.value).then(response => {
                  console.debug(response)
                  _ULF.dict.save()
                  select('#favdel').checked = true

                  resolve('gallery moved')
                  // don't understand why this needs to be here
                  window.opener.location.reload(false)
                  form.submit()
                })
              }
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
              newList.addGallery(gid, token, note.value).then(response => {
                console.debug(response)
                _ULF.dict.save()
                select('#favdel').checked = true
                resolve('gallery added')
                // don't understand why this needs to be here
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

    applyBtn.onclick = event => submitFavs(select("input[type='radio']:checked"), true)
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

      selection.children[1].style.filter = `invert(100%) hue-rotate(${inputcounter * HUEOFFSET}deg)`
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
    const mode = select('.searchnav').lastElementChild.firstElementChild
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
        favButton.style.filter = `invert(100%) hue-rotate(${offset * HUEOFFSET}deg)`
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
