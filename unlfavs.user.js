// ==UserScript==
// @name           dev unlimited favs
// @namespace      mail@zera.tax
// @description    Adds unlimited local favorite lists to sadpanda
// @license        GPL-3.0
// @include        /^https://e(x|-)hentai\.org/.*$/
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @require        https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.js
// @version        0.7
// ==/UserScript==


$(function() {
    // CONSTANTS
    const domain = window.location.hostname;
    if (domain == "exhentai.org") {
        const fav_icon = "background-image:url(https://exhentai.org/img/fav.png); background-position:0px -172px";
        const image_domain = "https://exhentai.org/img";
    } else {
        const fav_icon = "background-image:url(https://ehgt.org/g/fav.png); background-position:0px -172px";
        const image_domain = "https://ehgt.org/g";
    }

    // CLASSES
    class favLists {
        constructor(lists=[]) {
            this._lists = lists;
        }

        get lists()         { return this._lists; }

        newList(name=false, galleries=[]) {
            let index = this._lists.length;
            if(!name) {
                let name = "Favorites " + string(index);
            }
            let list = new favList(name, index, galleries);

            this._lists.push(list);
            _ULFjson.lists.push({
                "name":name,
                "galleries": []
            });
            save_gm();
        }

        removeList(list) {
            let index = this._lists.indexOf(list);
            if(index == -1) {
                Error('this list does not exist');
                return;
            }

            this._lists = remove(this._lists, this._lists[index]);
            let i, len;
            for (i = index, len = this._lists.length; i < len; i++) {
                this._lists[i]._id -= 1;
            }

            _ULFjson.lists = remove(_ULFjson.lists, _ULFjson.lists[index]);
            save_gm();
        }

        // get the list that contains the gallery
        getList(gallery) {
            for(let list of this._lists) {
                result = list.galleries.find(function(_gallery) {
                    return _gallery.gid == gallery.gid;
                });
                if(result) { break; }
            }
            return result;
        }
    }


    class favList {
        constructor(name, id, galleries=[]) {
            this._name = name;
            this._id = id;
            this._galleries = galleries;
        }

        get name()      { return this._name; }
        set name(name)  {
            this._name = name;
            _ULFjson.lists[this._id].name = name;
            save_gm();
        }

        galleries(order="faved", search=false) {
            if (search) {
                //
            } else {
                if (order == "faved") {
                    return this._galleries;
                } else if(order == "posted") {
                    return this._galleries.sort(function(a, b) {
                        // unix to date: new Date(UNIX_timestamp * 1000);
                        return new Date(b.info.posted * 1000) - new Date(a.info.posted * 1000);
                    });
                }
            }
        }

        addGallery(id, token, note) {
            let gallery = this._galleries.find(function(gallery) {
                return gallery.gid == id;
            });

            if (!gallery) {
                try {
                    let info = galleryInfo([[id, token]]);

                    gallery = {
                        "gid": id,
                        "gt": token,
                        "note": note,
                        "date": new Date(),
                        "info": info
                    };
                    this._galleries.push(gallery);
                } catch (err) {
                    console.log(err);
                    Error('could not get gallery info!');
                    return;
                }
            } else {
                Error('already added to this list!');
                return;
            }
            _ULFjson.lists[this._id].galleries.push(gallery);
            save_gm();
        }

        removeGallery(id) {
            let gallery = this._galleries.find(function(gallery) {
                return gallery.gid == id;
            });

            if (gallery) {
                this._galleries = remove(galleries, gallery);
            } else {
                Error('gallery is not in this list!');
                return;
            }
            _ULFjson.lists[this._id].galleries = remove(_ULFjson.lists[this._id].galleries, gallery);
            save_gm();
        }
    }

    // FUNCTIONS
    // SCRIPT INITIALIZATION
    function createLists() {
        let lists = [];

        _ULFjson.lists.forEach(function(list, index) {
            lists.push(new favList(name=list.name, id=index, galleries=list.galleries));
        });
        return new favLists(lists);
    }

    // USERSCRIPT SPECIFIC
    function load_gm(import_string=false) {
        let gm_string = "";

        if (import_string) {
            try {
                JSON.parse(import_string);
                gm_string = import_string;
            } catch (err) {
                console.log(err);
                Error('not a valid json supplied');
                return;
            }

        } else {
            gm_string = GM_getValue("favsJson", "");
        }

        if (!gm_string) {
            gm_string = '{' +
                '"lists": [' +
                '{' +
                '"name": "Favorites 10",' +
                '"galleries": []' +
                '}' +
                '],' +
                '"display": "thumb",' +
                '"order": "faved",' +
                '"version":' + GM_info.script.version +
                '}';
            GM_setValue("favsJson", gm_string);
        }

        let gm_json = JSON.parse(gm_string);

        if(versionCompare(String(gm_json.version), "0.7.0") == -1) {
            // fix saved jsons from < 0.7.0 versions
            // id from string to int
            for(let list of gm_json.lists) {
                for(let gallery of list.galleries) {
                    gallery.gid = parseInt(gallery.gid);
                }
            }
        }

        // update version
        gm_json.version = GM_info.script.version;

        return gm_json;
    }

    function save_gm() {
        GM_setValue("favsJson", JSON.stringify(_ULFjson));
    }

    // SADPANDA SPECIFIC
    function galleriesInfo(galleries) {
        // [' + id +', "' + token + '" ]
        let request = '{  "method": "gdata",  "gidlist": ' + galleries + ' }';
        let info;

        console.log("making http request for:");
        console.log(request);
        GM_xmlhttpRequest({
            method: "POST",
            data: request,
            url: "https://e-hentai.org/api.php",
            onload: function(res) {
                info = JSON.parse(res.responseText);
                console_log(info);

                return info.gmetadata;
            },
            onerror: function(err) {
                Error(err);
                return;
            }
        });
    }

    // URL MANIPULATION
    function addUrlParameter (url, value, parameter) {
        url = url.replace('#','');
        let param_index = url.indexOf(parameter);

        if(param_index>-1){
            let next_param_index = url.indexOf("&", param_index);

            if(next_param_index == -1) {
                next_param_index = param_index + parameter.length + value.length;
            }

            url = url.split('');
            url.splice((param_index+parameter.length), (next_param_index), value);
            url = url.join('');
        }else{
            url += parameter + value;
        }
        return url;
    }

    // based on: https://stackoverflow.com/a/5349087
    var QueryString = function () {
        // This function is anonymous, is executed immediately and
        // the return value is assigned to QueryString!
        let query_string = {};
        let query = window.location.search.substring(1);
        let vars = query.split("&");
        for (var i=0;i<vars.length;i++) {
            let pair = vars[i].split("=");
            // If first entry with this name
            if (typeof query_string[pair[0]] === "undefined") {
                query_string[pair[0]] = decodeURIComponent(pair[1]);
                // If second entry with this name
            } else if (typeof query_string[pair[0]] === "string") {
                let arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
                query_string[pair[0]] = arr;
                // If third or later entry with this name
            } else {
                query_string[pair[0]].push(decodeURIComponent(pair[1]));
            }
        }
        return query_string;
    }();

    // GENERIC FUNCTIONS
    function remove(array, element) {
        return array.filter(e => e !== element);
    }

    function download(text, name, type) {
        let a = document.createElement("a");
        let file = new Blob([text], {type: type});
        a.href = URL.createObjectURL(file);
        a.download = name;
        a.click();
    }

    // based on: https://stackoverflow.com/a/6078873
    function timeConverter(UNIX_timestamp) {
        let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let a = new Date(UNIX_timestamp * 1000);
        let year = a.getFullYear();
        let month = months[a.getMonth()];
        let date = a.getDate();
        let hour = a.getHours();
        let min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes();
        var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds();
        let time = year + '-' + month + '-' + date + ' ' + hour + ':' + min;

        return time;
    }

    // based on: https://gist.github.com/alexey-bass/1115557
    function versionCompare(left, right) {
        if (typeof left + typeof right != 'stringstring')
            return false;

        let a = left.split('.')
        ,   b = right.split('.')
        ,   i = 0, len = Math.max(a.length, b.length);

        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }

        return 0;
    }

    // LOAD SCRIPT
    var _ULFjson = load_gm();
    console.log(_ULFjson);
    var _ULF = createLists();

    // UI-MODIFICATIONS
    // SUB-DIRECTORIES
    if(window.location.pathname.includes("uconfig.php")) {
        console.log("adding ui to settings...");
        let favsel = $("#favsel");
        let selection_template = favsel.children(":last").clone();
        selection_template.find(".i").attr("title", "unlimited favorites");

        favsel.prev().append( "<br>Rename the last list to create a new one.<br>Click outside the text inputs to save!" );

        function newInput(name, id, type) {
            let selection = selection_template.clone();
            let input = selection.children().last().children().last();

            input.attr('name', "favorite_" + (10 + id));
            input.attr('_id', id);
            input.val(name);
            input.addClass("ulf " + type);

            selection.find(".i").css({"filter": "invert(100%) hue-rotate(" + id * 35 + "deg)"});
            selection.appendTo(favsel);
        }

        // add list inputs
        _ULF.lists.forEach(function(list, index) {
            newInput(list.name, index, "rename");
        });
        newInput("new list", _ULF.lists.length, "newlist");

        // add buttons
        {
            let button_template = $("#apply").clone();
            button_template.removeAttr('id');
            button_template.children().first().prop("type", "button");
            button_template.addClass("ulf");

            let btn_port = button_template.clone();
            let btnfile_import = btn_port.children().first();

            let btninp_import = btnfile_import.clone();
            let btninp_export = btnfile_import.clone();

            btn_port.css({"margin": "8px auto 10px 130px"});

            btninp_import.css({"padding": "2px 33px 2px", "margin": 0});
            btninp_export.css({"padding": "2px 33px 2px", "margin": 0});

            btninp_import.attr('name', "ulf_import");
            btninp_import.val("import favs");
            btninp_import.prop("type", "button");
            btninp_import.attr("for","ulf_import_json");


            btnfile_import.prop("type", "file");
            btnfile_import.prop("accept", ".json,application/json");
            btnfile_import.attr("id","ulf_import_json");

            btninp_export.attr('name', "ulf_export");
            btninp_export.val("export favs");
            btninp_export.prop("type", "button");

            //btn_port.appendTo(favsel.parent());
            favsel.parent().after(btn_port);
            btninp_import.appendTo(btn_port);
            btninp_export.appendTo(btn_port);
            btn_port.append("<br>");
            btnfile_import.appendTo(btn_port);
        }

        // BUTTON FUNCTIONS
        $(document).on('focusout', '.ulf.rename', function() {
            let elem = this;
            let id = elem.getAttribute('_id');

            if(elem.value == "") {
                console.log("deleting list " + id + "...");
                try {
                    if(_ULF.lists[id].galleries().length != 0){
                        alert("gallery not empty");
                    }
                    _ULF.removeList(_ULF.lists[id]);
                } catch(err) {
                    console.log(err);
                    alert("could not delete gallery");
                    return;
                }
                elem.parentElement.parentElement.remove();
                for(let input of $(".ulf:input")) {
                    input_id = input.getAttribute('_id');
                    if( input_id > id) {
                        input.setAttribute('_id', input_id -1);
                    }
                }
            } else {
                console.log("changing " + _ULF.lists[id].name + " to " + elem.value);
                try{
                    _ULF.lists[id].name = elem.value;
                } catch(err) {
                    console.log(err);
                }
            }
        });

        $(document).on('input', '.ulf.newlist', function() {
            let elem = $(this);
            let id = elem.attr('_id');

            console.log("creating new list...");
            _ULF.newList(name=elem.val());
            elem.removeClass("newlist");
            elem.addClass("rename");
            newInput("new list", _ULF.lists.length, "newlist");
        });
        $(document).on('click', '.ulf>input[name="ulf_export"]', function() {
            let file_name = 'unl_favs_' + new Date().toISOString() + '.json';
            download(JSON.stringify(_ULFjson), file_name, 'text/json');
        });
        let import_string = "";

        $(document).on('click', '.ulf>input[name="ulf_import"]', function() {
            if(!import_string) {
                alert("no file selected!");
                return;
            }
            try{
                _ULFjson = load_gm(import_string);
            } catch(err) {
                alert("no valid json supplied");
                return;
            }
            save_gm();
            location.reload();
        });
        $('#ulf_import_json').change(function (){
            let input = this;

            var reader = new FileReader();
            reader.onload = function(){
                try{
                    import_string = reader.result;
                    console.log(JSON.parse(import_string));
                } catch(err) {
                    alert("no valid json supplied");
                    return;
                }
            };
            reader.readAsText(input.files[0]);
        });
    }
});
