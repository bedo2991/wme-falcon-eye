// ==UserScript==
// @name        WME Falcon Eye
// @namespace   bedo2991-waze
// @version     1.0.0
// @description validates doglegs for Falcon
// @updateURL    https://github.com/bedo2991/wme-falcon-eye/releases/latest/download/wme-falcon-eye.user.js
// @downloadURL  https://github.com/bedo2991/wme-falcon-eye/releases/latest/download/wme-falcon-eye.user.js
// @author      bedo2991
// @match       https://www.waze.com/editor*
// @match       https://beta.waze.com/editor*
// @match       https://www.waze.com/*/editor*
// @match       https://beta.waze.com/*/editor*
// @exclude     https://www.waze.com/user/editor*
// @exclude     https://beta.waze.com/user/editor*
// @exclude     https://www.waze.com/editor/sdk*
// @exclude     https://beta.waze.com/editor/sdk*
// @website     https://docs.google.com/document/d/16p3AQg5-7HM-fz92ykkAipADnO3Aw2j3oCLCNmOml5c/edit?usp=sharing
// @require     https://update.greasyfork.org/scripts/24851/1558013/WazeWrap.js
// @grant       none
// @supportURL  https://www.waze.com/discuss/t/script-wme-falcon-eye/391102

// @require       file:///C:/Users/[USERNAME]/Documents/MyDir/.out/main.user.js
// ==/UserScript==

// make sure that inside Tampermonkey's extension settings (on the browser, not from TM) and allow "Local file access", as shown here: https://www.tampermonkey.net/faq.php?locale=en#Q204
// make sure that the snippts inside header.js and header-dev.js are the same, except for the one @require field
// adjust the require field to the location of the .out/main.user.js file inside this directory
// copy the above snippet (up to ==/Userscript==) inside Tampermonkey's editor and save it