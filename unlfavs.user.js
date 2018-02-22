// ==UserScript==
// @name           unlimited favs
// @namespace      zeratax@firemail.cc
// @description    Adds unlimited local favorite lists to sadpanda
// @license        GPL-3.0
// @include        https://e-hentai.org/*
// @include        https://g.e-hentai.org/*
// @include        http://exhentai.org/*
// @include        https://exhentai.org/*
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @require        https://ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js
// @require        https://cdnjs.cloudflare.com/ajax/libs/lodash.js/0.10.0/lodash.min.js
// @version        0.6.5
// ==/UserScript==

var favs = {};
var favsString = GM_getValue ("favsJson",  "");
if(!favsString){
    favsString = '{' +
        '"lists": [' +
        '{' +
        '"name": "Favorites 10",' +
        '"galleries": []' +
        '}' +
        '],' +
        '"display": "thumb",' +
        '"order": "faved"' +
        '}';
    GM_setValue ("favsJson", favsString );
}
favs = JSON.parse (favsString);

for (var i = 0; i < favs["lists"].length; i++) {
    arr = favs["lists"][i]["galleries"];
    favs["lists"][i]["galleries"] = arrUnique(arr);
    GM_setValue ("favsJson", JSON.stringify(favs) );
}

script_log(favs);
var lists = favs["lists"];
var last_list_index = [lists.length-1];
var selected = -1;
var faved_list;
var faved_gallery;
var box_height = 350;
var fav_select = "";
var current_gid;
var current_gt;
var current_fav;
var current_page = 0;
var current_domain = window.location.protocol + '//' + window.location.hostname;
var display_galleries = [];
var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];



if(window.location.hostname == "exhentai.org"){
    var fav_icon = "background-image:url(https://exhentai.org/img/fav.png); background-position:0px -172px";
    var image_domain = "https://exhentai.org/img";
}else{
    var fav_icon = "background-image:url(http://ehgt.org/g/fav.png); background-position:0px -172px";
    var image_domain = "http://ehgt.org/g";
}


var QueryString = function () {
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}();

function script_log(message) {
    console.log("[Unlimited Fav]:");
    console.log(message);
}

function arrUnique(arr) {
    var cleaned = [];
    arr.forEach(function(itm) {
        var unique = true;
        cleaned.forEach(function(itm2) {
            if (_.isEqual(itm, itm2)) unique = false;
        });
        if (unique)  cleaned.push(itm);
        else script_log("duplicate found");
    });
    return cleaned;
}


function isEven(n) {
    return n % 2 == 0;
}

function addUrlParameter (url, value, parameter) {
    url = url.replace('#','');
    var param_index = url.indexOf(parameter);
    if(param_index>-1){
        var next_param_index = url.indexOf("&", param_index);
        if(next_param_index == -1) {next_param_index = param_index+parameter.length+value.length;}
        url = url.split('');
        url.splice((param_index+parameter.length), (next_param_index), value);
        url = url.join('');
    }else{
        url += parameter + value;
    }
    return url;
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp * 1000);
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes(); var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds();
    var time = year + '-' + month + '-' + date + ' ' + hour + ':' + min;
    return time;
}

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}


if (favs["lists"].length === 0){
    script_log("creating new list");
    favs["lists"].push({"name": "Favorites " + (favs["lists"].length + 10), "galleries" : []});
    lists = favs["lists"];
    last_list_index = [lists.length-1];
    GM_setValue ("favsJson", JSON.stringify(favs) );
}

/*
if( favs["lists"][last_list_index]["galleries"].length > 0){
	script_log("creating new list");
	favs["lists"].push({"name": "Favorites " + (favs["lists"].length + 10), "galleries" : []});
	lists = favs["lists"];
	last_list_index = [lists.length-1];
	GM_setValue ("favsJson", JSON.stringify(favs) );
}
*/

if(window.location.pathname.includes("/g/")) {
    re = /\/g\/(\S+)\/(\S+)\//i;
    str = window.location.pathname;
    m = str.match(re);
    if (m) {
        current_gid = m[1];
        current_gt = m[2];
    }
    script_log(current_gid);
    script_log(current_gt);
    for (var i = 0; i < favs["lists"].length; i++) {
        for (var j = 0; j < favs["lists"][i]["galleries"].length; j++) {
            if(favs["lists"][i]["galleries"][j]["gid"] == current_gid && favs["lists"][i]["galleries"][j]["gt"] == current_gt){
                $("#favoritelink").html(favs["lists"][i]["name"]);
                $("#favoritelink").parent().prepend('<div style="float:left; cursor:pointer" id="fav"><div class="i" style="'+ fav_icon + '" title="' + favs["lists"][i]["name"] + '"></div></div>');
            }
        }
    }
}

if(window.location.pathname.includes("favorites.php")) {
    current_fav = QueryString.favcat;
    if(QueryString.page){
        page = QueryString.page;
    }else{
        page = -1;
    }
    if(QueryString.unlpage){
        current_page = QueryString.unlpage;
    }else{
        current_page = 0;
    }
    if(current_fav > 9){
        if(page < 9999){
            window.open(addUrlParameter(window.location.href,9999, "&page="),"_self");
        }
        if($("div p").text()=="No hits found" && (favs["lists"][current_fav-10]["galleries"].length-(current_page*25))>0){
            visible_galleries = ((current_page*25)+25);
            var previous_page = (parseInt(current_page)-1);
            if(previous_page<0){previous_page = 0;}
            var next_page = (parseInt(current_page)+1);
            if(next_page > Math.ceil((favs["lists"][current_fav-10]["galleries"].length)/25)-1){
                next_page = Math.ceil((favs["lists"][current_fav-10]["galleries"].length)/25)-1;
                visible_galleries = favs["lists"][current_fav-10]["galleries"].length;
            }
            $("div p").replaceWith('<p class="ip" style="margin-top:5px">Showing '+ ((current_page*25)+1) +'-'+  visible_galleries +' of ' + favs["lists"][current_fav-10]["galleries"].length + '</p>');
            $("div p").after('<table class="ptt" style="margin:2px auto 0px"><tbody><tr><td class="ptdd">&lt;</td><td class="ptds"><a href="" onclick="return false">1</a></td><td class="ptdd">&gt;</td></tr></tbody></table>');
            var option_2 = `<a class="display" href="#" rel="nofollow">Show List</a>`;
            var option_1 = `<span style="font-weight:bold">Thumbnails</span>`;
            var option_3 = `<span style="font-weight:bold">Favorited</span>`;
            var option_4 = `<a class="order" href="#"rel="nofollow">Use Posted</a>`;
            var option_5 = `<a class="order" href="#">Published</a>`;
            var option_6 = "Favorited";
            var display = "thumb";
            if (favs["order"]=="posted") {
                option_5 = "Published"; option_6 = `<a class="order" href="#">Favorited</a>`;
                option_4 = `<a class="order" href="#"rel="nofollow">Use Favorited</a>`;option_3 = `<span style="font-weight:bold">Posted</span>`;
                favs["lists"][current_fav-10]["galleries"].sort(function(a, b) {
                    a = a["info"]["posted"];
                    b = b["info"]["posted"];
                    return b-a;
                });
            }else{
                favs["lists"][current_fav-10]["galleries"].sort(function(a, b) {
                    a = a["date"];
                    b = b["date"];
                    return a>b ? -1 : a<b ? 1 : 0;
                });
            }
            if (favs["display"] =="list") {
                display = "list"; option_1 = `<span style="font-weight:bold">Show List</span>`; option_2 = `<a class="display" href="#" rel="nofollow">Thumbnails</a>`;
            }
            var fav_options = "";
            for (var j = 0; j < favs["lists"].length; j++) {
                fav_options += `<option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -172px" value="fav` + (j+10) + `">`+ favs["lists"][j]["name"]+`</option>`;
            }
            $("table").last().after(`<form name="favform" action="" method="post" style="margin:0"><div style="float:left; width:380px; position:relative; text-align:left"><div style="position:absolute; top:-18px; left:15px">Display: &nbsp;` + option_1 + ` &nbsp; [` + option_2 + `] &nbsp; &nbsp;Order: &nbsp;` + option_3 + ` &nbsp; [` + option_4 + `]</div></div><div style="position:relative; width:100%; clear:both"><div style="float:right; width:300px; position:relative; text-align:right"><div style="position:absolute; top:-30px; left:70px">Action:<select class="stdinput" name="ddact" style="height:21px; margin-left:13px; padding-left:10px; width:170px; background-repeat:no-repeat; background-image:url(`+image_domain+`/fav.png); background-position:4px 20px" onchange="update_favsel(this)"><option value="delete" selected="selected" style="height:17px; padding-left:10px; padding-top:4px">Remove from Favorites</option><optgroup label="Change Favorite Category" style="padding:3px 5px 5px 5px"><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px 1px" value="fav0">good stuff</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -18px" value="fav1">absolute best</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(` + image_domain + `/fav.png); background-repeat:no-repeat; background-position:2px -37px" value="fav2">Favorites 2</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -56px" value="fav3">Favorites 3</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -75px" value="fav4">Favorites 4</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -94px" value="fav5">Favorites 5</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -113px" value="fav6">Favorites 6</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -132px" value="fav7">Favorites 7</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+image_domain+`/fav.png); background-repeat:no-repeat; background-position:2px -151px" value="fav8">Favorites 8</option><option style="height:15px; padding-left:20px; padding-top:4px; background-image:url(`+ image_domain + `/fav.png); background-repeat:no-repeat; background-position:2px -170px" value="fav9">Favorites 9</option>` + fav_options+ `</optgroup></select></div></div><div style="clear:both"></div></div><div class="itg"><div class="c"></div></div><table class="ptb" style="margin:0px auto 10px"><tbody><tr><td class="ptdd">&lt;</td><td class="ptds"><a href="` + current_domain + `/favorites.php?favcat=` + current_fav + `" onclick="return false">1</a></td><td class="ptdd">&gt;</td></tr></tbody></table><div style="position:relative; width:100%; clear:both"><div style="float:right; width:100px; position:relative"><div style="position:absolute; top:-28px; left:43px"><input type="button" name="apply" value="Apply" class="stdbtn fav"></div></div><div style="clear:both"></div></div></form>`);
            if(display == "list"){
                $(".itg").append(`<tbody><tr><th style="width:92px">&nbsp;</th><th style="width:89px">` + option_5 + `</th><th style="min-width:610px">Name</th><th style="width:89px">` + option_6 + `</th><th style="width:34px; text-align:center"><input id="alltoggle" type="checkbox" onclick="toggle_all()"></th></tr></tbody>`);
            }
        }

        if(favs["lists"][current_fav-10]["galleries"].length > 25){
            $("tr").first().html('<td onclick="document.location=this.firstChild.href"><a href="' + addUrlParameter(window.location.href,previous_page, "&unlpage=") + '" onclick="return false; location.reload();">&lt;</a></td>');
            $("tr").last().html('<td onclick="document.location=this.firstChild.href"><a href="' + addUrlParameter(window.location.href,previous_page, "&unlpage=") + '" onclick="return false; location.reload();">&lt;</a></td>');
            for (var j = 0; j < Math.ceil((favs["lists"][current_fav-10]["galleries"].length)/25); j++) {
                if(j == current_page){
                    $("tr").first().append('<td class="ptds"><a href="' + window.location.href + '" onclick="return false">' + (j+1) + '</a></td>');
                    $("tr").last().append('<td class="ptds"><a href="' + window.location.href + '" onclick="return false">' + (j+1) + '</a></td>');

                }else{
                    $("tr").first().append('<td onclick="document.location=this.firstChild.href"><a href="' + addUrlParameter(window.location.href,j, "&unlpage=") + '" onclick="return false; location.reload();">' + (j+1) + '</a></td>');
                    $("tr").last().append('<td onclick="document.location=this.firstChild.href"><a href="' + addUrlParameter(window.location.href,j, "&unlpage=") + '" onclick="return false; location.reload();">' + (j+1) + '</a></td>');

                }
            }
            $("tr").first().append('<td onclick="document.location=this.firstChild.href"><a href="'+ addUrlParameter(window.location.href,next_page, "&unlpage=") + '" onclick="return false; location.reload();">&gt;</a></td>');
            $("tr").last().append('<td onclick="document.location=this.firstChild.href"><a href="'+ addUrlParameter(window.location.href,next_page, "&unlpage=") + '" onclick="return false; location.reload();">&gt;</a></td>');

        }
        $(".fp.fps").removeClass("fps");
        $(".id1").remove();
        for (var j = (current_page*25); j < favs["lists"][current_fav-10]["galleries"].length; j++) {
            display_galleries[j] = [parseInt(favs["lists"][current_fav-10]["galleries"][j]["gid"]), '"' + favs["lists"][current_fav-10]["galleries"][j]["gt"] + '"' ];
            if(j == (current_page*25)+24){
                break;
            }
        }
        var gidlist = "[" + display_galleries[(current_page*25)] + "]";
        for (var j = (current_page*25)+1; j < display_galleries.length; j++) {
            gidlist += ",[" + display_galleries[j] + "]";
        }

        var sadpandaRequest = '{  "method": "gdata",  "gidlist": [' + gidlist +']}';
        var sadpandaInfo;
        var ret = GM_xmlhttpRequest({
            method: "POST",
            data: sadpandaRequest,
            url: "https://e-hentai.org/api.php",
            onload: function(res) {

                sadpandaInfo = JSON.parse(res.responseText);
                script_log(sadpandaInfo);
                for (var j = (current_page*25); j < favs["lists"][current_fav-10]["galleries"].length; j++) {
                    var rate_offset = [0, 0];
                    rate_offset[1] = (80-Math.round(sadpandaInfo["gmetadata"][j-(current_page*25)]["rating"])*16)*-1;
                    if((Math.round(sadpandaInfo["gmetadata"][j-(current_page*25)]["rating"])-Math.floor(sadpandaInfo["gmetadata"][j-(current_page*25)]["rating"]))==0) {
                        rate_offset[0] = -20;
                        rate_offset[1] += 16;

                    }
                    var rate_thumb = '<div class="id43 ir" style="background-position:'+rate_offset[1]+'px '+rate_offset[0]+'px; opacity:0.93333333333333; margin-top:2px"></div>';
                    var rate_list = '<div class="ir it4r" style="background-position:'+rate_offset[1]+'px '+rate_offset[0]+'px; opacity:1"></div>';
                    if(display == "thumb"){
                        $(".itg").append(`<div class="id1" style="height:335px"><div class="id2"><a href="`+ current_domain + `/g/` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `/` + favs["lists"][current_fav-10]["galleries"][j]["gt"]+ `/">` + sadpandaInfo["gmetadata"][j-(current_page*25)]["title"] +`</a></div><div class="id3" style="height:280px"><a href="`+ current_domain + `/g/` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `/` + favs["lists"][current_fav-10]["galleries"][j]["gt"]+ `/"><img src="` + sadpandaInfo["gmetadata"][j-(current_page*25)]["thumb"] +`" alt="Free Hentai Doujinshi Gallery ` + sadpandaInfo["gmetadata"][j-(current_page*25)]["title"] + `" title="` + sadpandaInfo["gmetadata"][j-(current_page*25)]["title"] + `" style="position:relative; top:-3px"></a></div><div class="id4"><div class="id41" style="background-position:0 -35px" title="` + sadpandaInfo["gmetadata"][j-(current_page*25)]["category"] + `"></div><div class="id42">26 files</div>`+rate_thumb+`<div class="id44"><div style="float:right"><div onclick="return popUp('`+ current_domain + `/gallerypopups.php?gid=` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `&amp;t=` + favs["lists"][current_fav-10]["galleries"][j]["gt"]+ `&amp;act=addfav',675,415)" class="i" id="favicon_` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `" style="` + fav_icon + `; cursor:pointer; margin:5px 3px 0" title="` + favs["lists"][current_fav-10]["name"]+ `"></div><input type="checkbox" name="modifygids[]" value="` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `" style="position:relative; top:3px; left:-1px"></div></div></div></div>`);
                    }
                    if(display == "list"){
                        var date = new Date(favs["lists"][current_fav-10]["galleries"][j]["date"]);
                        var minute = addZero(date.getMinutes());
                        var hour = date.getHours();
                        var day = date.getDate();
                        var monthIndex = months[date.getMonth()];
                        var year = date.getFullYear();
                        if(isEven(j)){
                            color = 1;
                        }else{
                            color = 0;
                        }
                        var download_button="";
                        if(sadpandaInfo["gmetadata"][j-(current_page*25)]["torrentcount"]>0){
                            download_button = `<div class="i"><a href="`+current_domain+`/gallerytorrents.php?gid=` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `&amp;t=` + favs["lists"][current_fav-10]["galleries"][j]["gt"]+ `" onclick="return popUp('`+current_domain+`/gallerytorrents.php?gid=` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `&amp;t=` + favs["lists"][current_fav-10]["galleries"][j]["gt"]+ `', 610, 590)" rel="nofollow"><img src="`+image_domain+ `/t.png" class="n" alt="T" title="Torrents exist for this gallery"></a></div>`;
                        }
                        var note_field = ``;
                        if (favs["lists"][current_fav-10]["galleries"][j]["note"]){
                            var note= "Note: " + favs["lists"][current_fav-10]["galleries"][j]["note"];
                            note_field = `<div style="font-style:italic; clear:both; padding:3px 0 1px 5px; display:" id="favnote_` + sadpandaInfo["gmetadata"][j-(current_page*25)]["gid"] + `">`+note+`</div>`;
                        }
                        var thumb_img = $(".unl.fav.thumb");
                        var category_color;
                        switch (sadpandaInfo["gmetadata"][j-(current_page*25)]["category"].toLowerCase()) {
                            case "doujinshi":
                                category_color = "rgb(255, 0, 0)";
                                break;
                            case "game cg sets":
                                category_color = "rgb(0, 128, 0)";
                                break;
                            case "non-h":
                                category_color = "#16FFFC";
                                break;
                            case "manga":
                                category_color = "#FFA500";
                                break;
                            case "artist cg sets":
                                category_color = "#FFFF00";
                                break;
                            case "asian porn":
                                category_color = "rgb(238, 130, 238)";
                                break;
                            case "image sets":
                                category_color = "rgb(0, 0, 255)";
                                break;
                            case "western":
                                category_color = "rgb(137, 255, 22)";
                                break;
                            case "cosplay":
                                category_color = "#4B0082";
                                break;
                            case "misc":
                                category_color = "#000000";
                                break;
                        }
                        $("tbody").eq(1).append(`<tr class="gtr`+color+` color`+color+`"><td class="itdc"><img src="` + image_domain + `/c/`+  sadpandaInfo["gmetadata"][j-(current_page*25)]["category"].toLowerCase().replace("image sets","imageset").replace(" sets", "").replace(" ", "")+`.png" alt="` + sadpandaInfo["gmetadata"][j-(current_page*25)]["category"] + `" class="ic"></td><td class="itd" style="white-space:nowrap">` + timeConverter(sadpandaInfo["gmetadata"][j-(current_page*25)]["posted"]) + `</td><td class="itd"><div style="position:relative"><div class="it2" id="i` + sadpandaInfo["gmetadata"][j-(current_page*25)]["gid"] + `" style="border: 2px solid rgb(255, 0, 0); top: -52.5px; left: -216px; height: 101px; width: 200px; visibility: hidden;"><img class="unl fav thumb" src="` + sadpandaInfo["gmetadata"][j-(current_page*25)]["thumb"] + `" alt="` + sadpandaInfo["gmetadata"][j-(current_page*25)]["title"] +`" style="margin:0"></div><div class="it3"><div onclick="return popUp('` + current_domain + `/gallerypopups.php?gid=` + sadpandaInfo["gmetadata"][j-(current_page*25)]["gid"] + `&amp;t=` + sadpandaInfo["gmetadata"][j-(current_page*25)]["token"] +`&amp;act=addfav',675,415)" class="i" id="favicon_` + sadpandaInfo["gmetadata"][j-(current_page*25)]["gid"] + `" style="` + fav_icon + `; cursor:pointer" title="` + favs["lists"][current_fav-10]["name"] + `"></div>`+download_button+`</div><div class="it5"><a href="`+ current_domain + `/g/` + favs["lists"][current_fav-10]["galleries"][j]["gid"]+ `/` + favs["lists"][current_fav-10]["galleries"][j]["gt"]+ `" onmouseover="show_image_pane(` + favs["lists"][current_fav-10]["galleries"][j]["gid"] + `)" onmouseout="hide_image_pane(` + favs["lists"][current_fav-10]["galleries"][j]["gid"] + `)">` + sadpandaInfo["gmetadata"][j-(current_page*25)]["title"] + `</a></div><div class="it4">`+rate_list+`</div></div>`+note_field+`</td><td class="itd" style="white-space:nowrap">` + year +`-`+monthIndex+`-`+day + ` ` + hour +`:` + minute +`</td><td style="text-align:center"><input class="inp unlfav" type="checkbox" " name="modifygids[]" value="` +  favs["lists"][current_fav-10]["galleries"][j]["gid"] + `"></td></tr>`);
                        $("#i"+favs["lists"][current_fav-10]["galleries"][j]["gid"]).attr("style", "border: 2px solid "+category_color+"; top: -52.5px; left: -216px; height: "+thumb_img.clientHeight+"px; width: "+thumb_img.clientWidth+"px; visibility: hidden;");

                    }
                    if(j ==  (current_page*25)+24){
                        break;
                    }
                }
            }
        });

    }
    for (var i = 0; i < favs["lists"].length; i++) {
        if(current_fav ==(i+10)){ fav_select = "fps"; }else{ fav_select = "";}
        $(".nosel").children().eq(-3).after(`<div class="fp ` + fav_select + `" onclick="document.location='`+ current_domain + `/favorites.php?favcat=`  + (i+10) +`'" style="width:160px; padding:2px 0 0; float:left">` +
                                            `<div style="font-weight:bold; float:left; text-align:right; width:30px; height:20px; padding:2px 3px 0 0">` +  favs["lists"][i]["galleries"].length + `</div>` +
                                            `<div class="i" style="` + fav_icon + `; position:relative; top:1px" title="` +  favs["lists"][i]["name"] + `"></div>` +
                                            `<div style="float:left; text-align:left; height:20px; padding:2px 0 0 3px">` +  favs["lists"][i]["name"] + `</div>` +
                                            `</div>`);
    }
}

if(!window.location.pathname.includes("/g/") && !window.location.pathname.includes(".php")) {

    for (var i = 0; i < favs["lists"].length; i++) {
        for (var j = 0; j < favs["lists"][i]["galleries"].length; j++) {
            var thumb = favs["lists"][i]["galleries"][j]["info"]["thumb"].replace("https://exhentai.org" ,"").replace("http://ehgt.org/" ,"");
            if($("#dmi").find("a").text() == "Show Thumbnails") {
                script_log($('a[href="' + current_domain + '/g/' + favs["lists"][i]["galleries"][j]["gid"] + '/' + favs["lists"][i]["galleries"][j]["gt"] + '/' +'"]').length);
                if($('a[href="' + current_domain + '/g/' + favs["lists"][i]["galleries"][j]["gid"] + '/' + favs["lists"][i]["galleries"][j]["gt"] + '/' +'"]').length){
                    $('a[href="' + current_domain + '/g/' + favs["lists"][i]["galleries"][j]["gid"] + '/' + favs["lists"][i]["galleries"][j]["gt"] + '/' +'"]').first().parent().parent().find(".it3").append(`<div onclick="return popUp('https://e-hentai.org/gallerypopups.php?gid=` + favs["lists"][i]["galleries"][j]["gid"] + `&amp;t=` + favs["lists"][i]["galleries"][j]["gt"] + `&amp;act=addfav',675,415)" class="i" id="favicon_`+ favs["lists"][i]["galleries"][j]["gid"] +`" style="` + fav_icon + `; cursor:pointer;" title="` + favs["lists"][i]["name"] + `"></div>`);
                }else{

                    $('div:contains("' + thumb + '")').last().parent().parent().find(".it3").append(`<div onclick="return popUp('https://e-hentai.org/gallerypopups.php?gid=` + favs["lists"][i]["galleries"][j]["gid"] + `&amp;t=` + favs["lists"][i]["galleries"][j]["gt"] + `&amp;act=addfav',675,415)" class="i" id="favicon_`+ favs["lists"][i]["galleries"][j]["gid"] +`" style="` + fav_icon + `; cursor:pointer;" title="` + favs["lists"][i]["name"] + `"></div>`);
                }
            }else{
                if($('a[href="' + current_domain + '/g/' + favs["lists"][i]["galleries"][j]["gid"] + '/' + favs["lists"][i]["galleries"][j]["gt"] + '/' +'"]').length){
                    $('a[href="' + current_domain + '/g/' + favs["lists"][i]["galleries"][j]["gid"] + '/' + favs["lists"][i]["galleries"][j]["gt"] + '/' +'"]').first().parent().parent().find(".id44").children().first().append(`<div onclick="return popUp('https://e-hentai.org/gallerypopups.php?gid=` + favs["lists"][i]["galleries"][j]["gid"] + `&amp;t=` + favs["lists"][i]["galleries"][j]["gt"] + `&amp;act=addfav',675,415)" class="i" id="favicon_`+ favs["lists"][i]["galleries"][j]["gid"] +`" style="` + fav_icon + `; cursor:pointer;  margin:5px 3px 0" title="` + favs["lists"][i]["name"] + `"></div>`);
                }else{
                    $('img[src*="'+ thumb +'"]').first().parent().parent().parent().find(".id44").children().first().append(`<div onclick="return popUp('https://e-hentai.org/gallerypopups.php?gid=` + favs["lists"][i]["galleries"][j]["gid"] + `&amp;t=` + favs["lists"][i]["galleries"][j]["gt"] + `&amp;act=addfav',675,415)" class="i" id="favicon_`+ favs["lists"][i]["galleries"][j]["gid"] +`" style="` + fav_icon + `; cursor:pointer;  margin:5px 3px 0" title="` + favs["lists"][i]["name"] + `"></div>`);
                }
            }
        }
    }
}

if(window.location.pathname.includes("uconfig.php")) {
    for (var i = 0; i < favs["lists"].length; i++) {
        $("#favsel").append('<div class="fs1" name=' + i + '>' +
                            '<div class="fs2"><div class="i" style="' + fav_icon + '" title="' + favs["lists"][i]["name"] + '"></div></div>' +
                            '<div class="fs3"><input name="' + favs["lists"][i]["name"] + '" value="' + favs["lists"][i]["name"] + '" size="20" maxlength="20" class="stdinput unlfav ' + i + '"></div>' +
                            '<div class="cl"></div>' +
                            '</div>');
    }
    for (var i = 0; i < favs["lists"].length; i++) {
        $("#favsel").append('<br>');
    }
    $("#favsel").append('<br>');
    $('#favsel').append('<input type="button" name="add" value="Add Favorite List" class="stdbtn unlfav add">');
    $('#favsel').append('<input type="button" name="remove" value="Remove Favorite List" class="stdbtn unlfav rem">');
    $("#favsel").append('<br>');
    $('#favsel').append('<input type="button" name="export" value="Export Favorite List Settings" class="stdbtn unlfav export">');
    $('#favsel').append('<input type="button" name="import" value="Import Favorite List Settings" class="stdbtn unlfav import">');
    $('#favsel').append('<input type="file" id="file" name="file" enctype="multipart/form-data" style="display: none;"/>');
}

if(window.location.pathname.includes("gallerypopups.php")) {
    current_gid = QueryString.gid;
    current_gt = QueryString.t;
    script_log(current_gid);
    script_log(current_gt);
    $("#galpop").attr('method', 'get');
    $("#galpop").attr("id","disabledpost");
    $(".stdbtn").attr('type', 'button');
    $(".stdbtn").addClass("sel");
    $( "input[name='apply']" ).attr('type', 'button');
    for (var i = 0; i < favs["lists"].length; i++) {
        script_log("appending favorite tab " + favs["lists"][i]["name"]);
        $(".nosel").append(' <div style="height:25px; cursor:pointer"> ' +
                           '<div style="float:left"><input name="favcat" value="' + (i + 10) + '" id="fav' + (i + 10) + '" style="position:relative; top:-1px" onclick="clicked_fav(this)" type="radio"></div>' +
                           '<div style="float:left; padding:1px 1px 0 4px; height:15px; width:15px; background-repeat:no-repeat;' + fav_icon + '" onclick="document.getElementById(`fav' + (i + 10) + '`).click()"></div>' +
                           '<div style="float:left; padding-top:1px" onclick="document.getElementById(`fav' + (i + 10) + '`).click()">' + favs["lists"][i]["name"] + '</div>' +
                           '<div class="c"></div>' +
                           '</div>');
        box_height += 25;
        $(".stuffbox").attr("style","width:584px; height:" + box_height + "px; margin:2px auto; text-align:left; padding:8px; font-size:9pt");
        for (var j = 0; j < favs["lists"][i]["galleries"].length; j++) {
            if(favs["lists"][i]["galleries"][j]["gid"] == current_gid && favs["lists"][i]["galleries"][j]["gt"] == current_gt){
                $("#fav" + (i+10)).prop("checked", true);
                selected = i+10;
                faved_list = i;
                faved_gallery = j;
                script_log("saved in list " + favs["lists"][faved_list]["name"] + " in gallery " + faved_gallery);
                $("textarea").val(favs["lists"][faved_list]["galleries"][faved_gallery]["note"]);
            }
        }
    }
    $("#favdel").parent().parent().remove();
    $(".nosel").append('<div style="height:25px; cursor:pointer"><div style="float:left"><input type="radio" name="favcat" value="favdel" id="favdel" style="position:relative; top:-1px" onclick="clicked_fav(this)"></div><div style="float:left; padding-left:5px" onclick="document.getElementById(`favdel`).click()">Remove from Favorites</div><div class="c"></div></div>');
}

$('.stdinput.unlfav').each(function() {
    var elem = $(this);

    // Save current value of element
    elem.data('oldVal', elem.val());

    // Look for changes in the value
    elem.bind("propertychange change click keyup input paste", function(event){
        // If value has changed...
        if (elem.data('oldVal') != elem.val()) {
            script_log("changing " + elem.data('oldVal') + " to " + favs["lists"][$(this).parent().parent().attr("name")]["name"]);
            favs["lists"][$(this).parent().parent().attr("name")]["name"] = elem.val();
            GM_setValue ("favsJson", JSON.stringify(favs) );
        }
    });
});

$('#file').on('change', function() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onload = function() {
        favs=JSON.parse(this.result);
        script_log(favs);
        GM_setValue ("favsJson", JSON.stringify(favs) );
        location.reload();
    };
    reader.readAsText(file);
});

$(function(){
    $('.stdbtn.fav').click(function(){
        script_log("yo");
        $(".inp.unlfav:checked").each(function( index ) {
            script_log( $( this ).val() );
            script_log( $( this ).attr("token") );
            $( "#stdinput option:selected" ).text();
        });

    });
    $('.order').click(function(){
        if(favs["order"]=="posted"){
            favs["order"]="faved";
        }else{
            favs["order"]="posted";
        }
        GM_setValue ("favsJson", JSON.stringify(favs) );
        location.reload();
    });
    $('.display').click(function(){
        if(favs["display"]=="list"){
            favs["display"]="thumb";
        }else{
            favs["display"]="list";
        }
        GM_setValue ("favsJson", JSON.stringify(favs) );
        location.reload();
    });
    $('input[type="radio"]').click(function(){
        selected = $(this).attr("value");
    });
    $('.stdbtn.unlfav.import').click(function(){
        $('#file').click();
    });
    $('.stdbtn.unlfav.export').click(function(){
        $("#favsel").append('<a id="downloadAnchorElem" style="display:none"></a>');
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(favs));
        var dlAnchorElem = document.getElementById('downloadAnchorElem');
        dlAnchorElem.setAttribute("href",     dataStr     );
        dlAnchorElem.setAttribute("download", "unl_fav.json");
        dlAnchorElem.click();
    });
    $('.stdbtn.unlfav.add').click(function(){
        script_log("adding another list");
        favs["lists"].push({"name": "Favorites " + (favs["lists"].length + 10), "galleries" : []});
        GM_setValue ("favsJson", JSON.stringify(favs) );
        lists = favs["lists"];
        last_list_index = [lists.length-1];
        $("#favsel").find(".fs1").last().after('<div class="fs1" name=' + i + '>' +
                                               '<div class="fs2"><div class="i" style="' + fav_icon + '" title="' + favs["lists"][last_list_index]["name"] + '"></div></div>' +
                                               '<div class="fs3"><input name="' + favs["lists"][last_list_index]["name"] + '" value="' + favs["lists"][last_list_index]["name"] + '" size="20" maxlength="20" class="stdinput unlfav ' + last_list_index + '"></div>' +
                                               '<div class="cl"></div>' +
                                               '</div>');
        $("#favsel").find(".fs1").last().after('<br>');
    });
    $('.stdbtn.unlfav.rem').click(function(){
        if(favs["lists"][last_list_index]["galleries"].length > 0){
            var fav_del = false;
            var r = confirm("Do you want to delete this list?\n(Contains " + favs["lists"][last_list_index]["galleries"].length + " galleries)");
            if (r == true) {
                fav_del = true;
            }
        }
        if(favs["lists"][last_list_index]["galleries"].length === 0 || fav_del === true) {
            script_log("removing list " + favs["lists"][last_list_index]["name"]);
            favs["lists"].splice(last_list_index, 1);
            GM_setValue ("favsJson", JSON.stringify(favs) );
            $(".stdinput.unlfav." + last_list_index).parent().parent().next().remove();
            $(".stdinput.unlfav." + last_list_index).parent().parent().remove();
            lists = favs["lists"];
            last_list_index = [lists.length-1];
        }
    });
    $( "input[name='apply']" ).click(function(){
        if(faved_list+10) {

            if(faved_list+10 != selected) {
                script_log("removing from list " + favs["lists"][faved_list]["name"]);
                favs["lists"][faved_list]["galleries"].splice(faved_gallery, 1);
                /*
				if(favs["lists"][faved_list]["galleries"].length === 0 && faved_list == parseInt(last_list_index)-1) {
					script_log("removing empty list " + favs["lists"][faved_list+1]["name"]);
					favs["lists"].splice(faved_list+1, 1);
				}
				*/
                GM_setValue ("favsJson", JSON.stringify(favs) );
            }
        }
        if(selected > 9 && faved_list+10 != selected) {
            var sadpandaRequest = '{  "method": "gdata",  "gidlist": [[' + current_gid +', "' + current_gt + '" ] ]}';
            var sadpandaInfo;

            script_log(sadpandaRequest);
            var ret = GM_xmlhttpRequest({
                method: "POST",
                data: sadpandaRequest,
                url: "https://e-hentai.org/api.php",
                onload: function(res) {
                    sadpandaInfo = JSON.parse(res.responseText);
                    script_log(sadpandaInfo);
                    info = sadpandaInfo["gmetadata"][0];

                    script_log("adding gallery to list " + favs["lists"][(selected-10)]["name"]);
                    favs["lists"][(selected-10)]["galleries"].push({"gid": current_gid, "gt": current_gt, "note": $("textarea").val(), "date": new Date(), "info": info});
                    GM_setValue ("favsJson", JSON.stringify(favs) );
                    $("#favdel").prop("checked", true);
                    $("#disabledpost").attr("id","galpop");
                    $("#galpop").attr('method', 'post');
                    $('#galpop').submit();
                }
            });
        }
        if(faved_list+10 == selected){
            favs["lists"][faved_list]["galleries"][faved_gallery]["note"] = $("textarea").val();
            GM_setValue ("favsJson", JSON.stringify(favs) );
            $("#favdel").prop("checked", true);
            setTimeout(function(){
                $("#disabledpost").attr("id","galpop");
                $("#galpop").attr('method', 'post');
                $('#galpop').submit();
            },250);
        }
        if(selected <= 9 || selected == "favdel"){
            setTimeout(function(){
                $("#disabledpost").attr("id","galpop");
                $("#galpop").attr('method', 'post');
                $('#galpop').submit();
            },250);
        }
    });
});
