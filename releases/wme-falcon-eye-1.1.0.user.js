// ==UserScript==
// @name        WME Falcon Eye
// @namespace   bedo2991-waze
// @version     1.1.0
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
// @website https://docs.google.com/document/d/16p3AQg5-7HM-fz92ykkAipADnO3Aw2j3oCLCNmOml5c/edit?usp=sharing
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    window.SDK_INITIALIZED.then(initScript);
    function initScript() {
        if (!window.getWmeSdk) {
            throw new Error("SDK not available");
        }
        const wmeSDK = window.getWmeSdk({
            scriptId: "wme-falcon-eye",
            scriptName: "WME Falcon Eye"
        });
        let AlertType;
        (function (AlertType) {
            AlertType["INFO"] = "info";
            AlertType["ERROR"] = "error";
            AlertType["SUCCESS"] = "success";
            AlertType["WARNING"] = "warning";
            AlertType["DEBUG"] = "debug";
        })(AlertType || (AlertType = {}));
        const safeAlert = (level, message) => {
            try {
                WazeWrap.Alerts[level](GM_info.script.name, message);
            }
            catch (e) {
                console.error(e);
                alert(message);
            }
        };
        function addLayers() {
            wmeSDK.Map.addLayer({
                layerName: "Falcon Eye Labels",
                styleContext: {
                    getLabel: ({ feature }) => feature?.properties.label ?? "",
                    getXOffset: ({ feature }) => feature?.properties.xOffset ?? 0,
                    getYOffset: ({ feature }) => feature?.properties.yOffset ?? 0,
                },
                styleRules: [
                    {
                        style: {
                            'fontFamily': 'Rubik, Open Sans, Alef, helvetica, sans-serif',
                            'label': "${getLabel}",
                            'labelYOffset': "${getXOffset}",
                            'labelXOffset': "${getYOffset}",
                            'fontColor': '#f00',
                            'fontSize': "30",
                            'fontWeight': "800",
                            'labelOutlineColor': '#4B0082',
                            'labelOutlineWidth': 2,
                            'pointerEvents': 'none',
                            'labelAlign': 'cm',
                            'visibility': true,
                        }
                    }
                ]
            });
        }
        const SCRIPT_VERSION = GM_info.script.version;
        const SCRIPT_NAME = GM_info.script.name;
        let States;
        (function (States) {
            States["enabled"] = "E";
            States["disabled"] = "D";
            States["zoom_disabled"] = "ZD";
        })(States || (States = {}));
        const scriptEnabledDefault = true;
        const energy_saving_enabledDefault = true;
        const checkFromZoomDefault = 17;
        const settings = Object.seal({
            script_enabled: scriptEnabledDefault,
            energy_saving: energy_saving_enabledDefault,
            check_from_zoom: checkFromZoomDefault
        });
        const One80DividedByPi = 180.0 / Math.PI;
        let OLWazeProjection;
        let WorldGeodeticSystemProjection;
        const ANGLE1_MIN = 170.0;
        const ANGLE1_MAX = 190.0;
        const ANGLE2_MIN = 20.0;
        const ANGLE2_MAX = 55.0;
        const OFFRAMP_MIN_LENGTH = 12.0;
        const INCOMING_MIN_LENGTH = 12.0;
        const DELTA_MAX = 10.0;
        const warningStyle = {
            'pointerEvents': 'none',
            'strokeColor': '#9932CC',
            'strokeWidth': 25,
            'strokeOpacity': 0.5,
            'strokeDashstyle': 'solid',
            'strokeLinecap': 'butt',
        };
        const successStyle = {
            'pointerEvents': 'none',
            'strokeColor': '#00ff00',
            'strokeWidth': 25,
            'strokeOpacity': 0.5,
            'strokeDashstyle': 'solid',
            'strokeLinecap': 'butt',
        };
        const errorStyle = {
            'pointerEvents': 'none',
            'strokeColor': '#ff0000',
            'strokeWidth': 25,
            'strokeOpacity': 0.5,
            'strokeDashstyle': 'solid',
            'strokeLinecap': 'butt',
        };
        let doglegLayer;
        async function init() {
            addLayers();
            await setUpLeftPanel();
            waitForWazeWrap().then((result) => {
                if (result === true) {
                    initWazeWrapElements();
                }
            });
            initOpenLayersElements();
            initDoglegLayer();
            manageStateChange();
            initEvents();
            startCheck();
        }
        function initOpenLayersElements() {
            OLWazeProjection = W.map.getOLMap().projection;
            WorldGeodeticSystemProjection = new OpenLayers.Projection('EPSG:4326');
        }
        function createInput({ id, type, className, title, min, max, step }) {
            const input = document.createElement('input');
            input.id = 'dog_' + id;
            if (className) {
                input.className = className;
            }
            {
                input.title = title;
            }
            input.type = type;
            return input;
        }
        function createCheckboxOption({ id, title, description }) {
            const line = document.createElement('div');
            const label = document.createElement('label');
            label.innerText = title;
            line.className = 'prefLineCheckbox';
            const input = createInput({
                id,
                type: 'checkbox',
                title: 'true or false',
            });
            label.appendChild(input);
            line.appendChild(label);
            const i = document.createElement('i');
            i.innerText = description;
            line.appendChild(i);
            return line;
        }
        function createDropdownOption({ id, title, description, options, isNew }) {
            const line = document.createElement('div');
            line.className = 'prefLineSelect';
            if (typeof isNew === 'string') {
                line.classList.add('newOption');
                line.dataset.version = isNew;
            }
            const newSelect = document.createElement('select');
            newSelect.className = 'prefElement';
            const label = document.createElement('label');
            label.innerText = title;
            newSelect.id = `dog_${id}`;
            if (options && options.length > 0) {
                if (typeof options[0] === "object") {
                    options.forEach((o) => {
                        const option = document.createElement('option');
                        option.text = o.text;
                        option.value = o.value;
                        newSelect.add(option);
                    });
                }
                else {
                    options.forEach((o) => {
                        const option = document.createElement('option');
                        option.text = o;
                        option.value = o;
                        newSelect.add(option);
                    });
                }
            }
            const i = document.createElement('i');
            i.innerText = description;
            line.appendChild(label);
            line.appendChild(i);
            line.appendChild(newSelect);
            return line;
        }
        function setScriptStatus(state) {
            const div = document.getElementById("dog_script_state");
            switch (state) {
                case States.enabled:
                    div.innerText = "✅";
                    break;
                case States.disabled:
                    div.innerText = "🛑";
                    break;
                case States.zoom_disabled:
                    div.innerText = "🔍🔙";
                    break;
                default:
                    alert("DOG: Invalid state");
            }
        }
        async function setUpLeftPanel() {
            const mainDiv = document.createElement('div');
            const title = document.createElement('h4');
            title.innerText = SCRIPT_NAME;
            mainDiv.appendChild(title);
            const spanVersion = document.createElement('span');
            spanVersion.innerText = `Version ${SCRIPT_VERSION}`;
            mainDiv.appendChild(spanVersion);
            const divStatus = document.createElement('div');
            divStatus.id = "dog_script_state";
            divStatus.style.float = "right";
            mainDiv.appendChild(divStatus);
            let enableCB = createCheckboxOption({
                id: "enable",
                title: "Script enabled",
                description: "When checked, segments get analysed for doglegs"
            });
            mainDiv.appendChild(enableCB);
            let energyCB = createCheckboxOption({
                id: "energy",
                title: "Energy saving",
                description: "When checked, the segment verification stops as soon as a problem has been found."
            });
            mainDiv.appendChild(energyCB);
            let zoomRange = createDropdownOption({ id: "zoom", title: "Enabled from zoom", description: "The script only scans the map from zoom ", options: ["14", "15", "16", "17", "18", "19", "20", "21", "22"] });
            mainDiv.appendChild(zoomRange);
            let angle1String = `[_._]: should be between ${ANGLE1_MIN}° and ${ANGLE1_MAX}°`;
            let angle2String = `[⑂]: should be between ${ANGLE2_MIN}° and ${ANGLE2_MAX}°`;
            let offrampLengthString = `The 2nd subsegment of the offramp should be at least ${OFFRAMP_MIN_LENGTH}m long`;
            let incomingLengthString = `The last subsegment of the incoming highway should be at least ${INCOMING_MIN_LENGTH}m long`;
            let deltaString = `Δ: The difference between the heading of the 1st subsegment of the outgoing highway and the 2nd subsegment of the offramp may differ of maximum  ${DELTA_MAX}°`;
            const style = document.createElement("style");
            style.textContent =
                `.dog_errorLine {
            padding: 5pt;
            color: #3d3d3d;
            background-color: #eeeeee;
            border-bottom: 1px solid black;
            }
            .dog_prefLineCheckbox{width:100%; margin-bottom:1vh;}
            .dog_prefLineCheckbox label{display:block;width:100%}
            .dog_prefLineCheckbox input{float:right;}
            `;
            document.head.appendChild(style);
            const heuristicRules = document.createElement('h5');
            heuristicRules.innerText = "Heuristic rules";
            mainDiv.appendChild(heuristicRules);
            const errorAngle1 = document.createElement('div');
            errorAngle1.innerText = angle1String;
            errorAngle1.className = "dog_errorLine";
            mainDiv.appendChild(errorAngle1);
            const errorAngle2 = document.createElement('div');
            errorAngle2.innerText = angle2String;
            errorAngle2.className = "dog_errorLine";
            mainDiv.appendChild(errorAngle2);
            const errorOfframp = document.createElement('div');
            errorOfframp.innerText = offrampLengthString;
            errorOfframp.className = "dog_errorLine";
            mainDiv.appendChild(errorOfframp);
            const errorIncoming = document.createElement('div');
            errorIncoming.innerText = incomingLengthString;
            errorIncoming.className = "dog_errorLine";
            mainDiv.appendChild(errorIncoming);
            const errorDelta = document.createElement('div');
            errorDelta.innerText = deltaString;
            errorDelta.className = "dog_errorLine";
            mainDiv.appendChild(errorDelta);
            const { tabLabel, tabPane } = await wmeSDK.Sidebar.registerScriptTab();
            tabLabel.innerText = '🐦';
            tabLabel.title = 'Falcon Eye';
            tabPane.innerHTML = mainDiv.innerHTML;
            loadSettings();
            updateSettingsUI();
            addSettingsEventListeners();
        }
        function applyDefaultValues() {
            setSettingsDefaultValues();
            updateSettingsUI();
        }
        function updateSettingsUI() {
            document.getElementById("dog_enable").checked = settings.script_enabled;
            document.getElementById("dog_energy").checked = settings.energy_saving;
            document.getElementById("dog_zoom").value = String(settings.check_from_zoom);
        }
        function addSettingsEventListeners() {
            document.getElementById("dog_enable").addEventListener("click", toggleEnableCheckbox);
            document.getElementById("dog_energy").addEventListener("click", toggleEnergySavingCheckbox);
            document.getElementById("dog_zoom").addEventListener("change", zoomSettingChanged);
        }
        function storeSettings() {
            try {
                localStorage.setItem("falcon-eye", JSON.stringify({
                    "v": SCRIPT_VERSION,
                    "settings": {
                        "script_enabled": settings.script_enabled,
                        "energy_saving": settings.energy_saving,
                        "check_from_zoom": settings.check_from_zoom,
                    }
                }));
            }
            catch (ex) {
                safeAlert(AlertType.ERROR, "Could not store settings in your browser");
            }
        }
        function setSettingsDefaultValues() {
            settings.script_enabled = scriptEnabledDefault;
            settings.energy_saving = energy_saving_enabledDefault;
            settings.check_from_zoom = checkFromZoomDefault;
        }
        function loadSettings() {
            const loadedSettings = localStorage.getItem("falcon-eye");
            if (!loadedSettings) {
                applyDefaultValues();
                return;
            }
            const storedSettings = JSON.parse(loadedSettings);
            if (!storedSettings) {
                console.warn("Falcon Eye: setting found, but could not parse them.");
                applyDefaultValues();
                return;
            }
            settings.script_enabled = storedSettings.settings.script_enabled;
            settings.energy_saving = storedSettings.settings.energy_saving;
            settings.check_from_zoom = storedSettings.settings.check_from_zoom;
        }
        function zoomSettingChanged(e) {
            settings.check_from_zoom = parseInt(e.target.value);
            storeSettings();
        }
        function toggleEnableCheckbox(e) {
            settings.script_enabled = e.target.checked;
            storeSettings();
            manageStateChange();
        }
        function manageStateChange() {
            if (settings.script_enabled) {
                removeEvents();
                initEvents();
                setScriptStatus(States.enabled);
            }
            else {
                removeEvents();
                clearAll();
                setScriptStatus(States.disabled);
            }
        }
        function toggleEnergySavingCheckbox(e) {
            settings.check_from_zoom = e.target.checked;
            safeAlert(AlertType.INFO, settings.check_from_zoom ? "The script will stop looking for problems after finding one" : "The script will show all doglegs problems at once");
            storeSettings();
        }
        function initWazeWrapElements() {
            WazeWrap.Interface.ShowScriptUpdate(SCRIPT_NAME, SCRIPT_VERSION, `<b>What's new?</b>
            <ul>
            <li>1.0.0: Use the new WME API, store the settings when they get changed.
            <li>0.0.9.5: The checkbox to disable the script now really disables the script. It is possible to select from what zoom level the script should work. The script state gets displayed in the script's panel.</li>
            <li>0.0.9.3: Fixes a problem with zoom while a segment is selected</li>
            <li>0.0.9.2: Fixes a problem when a ramp does not have enough geonodes</li>
            <li>0.0.7: Use realsize distance (take Earth curvature into consideration)</li>
            </ul>`, "", GM_info.script.supportURL);
        }
        async function waitForWazeWrap() {
            let trials = 1;
            let sleepTime = 400;
            do {
                if (!WazeWrap ||
                    !WazeWrap.Ready ||
                    !WazeWrap.Interface ||
                    !WazeWrap.Alerts) {
                    await sleep(trials * sleepTime);
                }
                else {
                    return true;
                }
            } while (trials++ <= 30);
            console.error('DOG: could not initialize WazeWrap');
            throw new Error('DOG: could not initialize WazeWrap');
        }
        function sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }
        let dataLoadedEvent = () => { };
        let segmentChanged = () => { };
        function removeEvents() {
            dataLoadedEvent();
            segmentChanged();
            wmeSDK.Events.stopDataModelEventsTracking({ dataModelName: "segments" });
            dataLoadedEvent = () => { };
            segmentChanged = () => { };
        }
        function initEvents() {
            dataLoadedEvent = wmeSDK.Events.on({
                eventHandler: startCheck,
                eventName: "wme-map-data-loaded"
            });
            segmentChanged = wmeSDK.Events.on({
                eventHandler: startCheck,
                eventName: "wme-data-model-objects-changed"
            });
            wmeSDK.Events.trackDataModelEvents({ dataModelName: "segments" });
        }
        function clearAll() {
            clearLayer();
            clearLabelLayer();
        }
        function clearLabelLayer() {
            wmeSDK.Map.removeAllFeaturesFromLayer({
                layerName: "Falcon Eye Labels"
            });
        }
        function clearLayer() {
            doglegLayer.destroyFeatures(undefined, { 'silent': true });
        }
        function startCheck() {
            clearAll();
            if (wmeSDK.Map.getZoomLevel() >= settings.check_from_zoom) {
                setScriptStatus(States.enabled);
                checkSegments(Object.values(W.model.segments.objects));
            }
            else {
                setScriptStatus(States.zoom_disabled);
            }
        }
        function ja_angle_diff(aIn, aOut, absolute = true) {
            let a = aOut - aIn;
            if (a > 180.0) {
                a -= 360.0;
            }
            if (a < -180) {
                a += 360.0;
            }
            return absolute ? a : (a > 0.0 ? a - 180.0 : a + 180.0);
        }
        function initDoglegLayer() {
            doglegLayer = new OpenLayers.Layer.Vector("dogleg_layer", {
                'visibility': true
            });
            W.map.getOLMap().addLayer(doglegLayer);
        }
        function detectDoglegCandidate(segmentModel) {
            const nodogleg = { isDoglegCandidate: false };
            let s2 = null;
            let offramp = null;
            if (!segmentModel.isOneWay()) {
                return nodogleg;
            }
            const attr1 = segmentModel.attributes;
            let roadType1 = attr1.roadType;
            if (![3, 6, 7].includes(roadType1)) {
                return nodogleg;
            }
            if (attr1.junctionID !== null) {
                return nodogleg;
            }
            let middleNodeModel = null;
            if (attr1.fwdDirection) {
                middleNodeModel = W.model.nodes.getObjectById(attr1.toNodeID);
            }
            else {
                middleNodeModel = W.model.nodes.getObjectById(attr1.fromNodeID);
            }
            if (!middleNodeModel) {
                return nodogleg;
            }
            const connectedSegmentsIDs = middleNodeModel.getSegmentIds();
            if (connectedSegmentsIDs.length !== 3) {
                return nodogleg;
            }
            for (let i = 0; i < connectedSegmentsIDs.length; i++) {
                if (connectedSegmentsIDs[i] === attr1.id) {
                    continue;
                }
                let otherSegment = W.model.segments.getObjectById(connectedSegmentsIDs[i]);
                if (!otherSegment)
                    continue;
                if (!middleNodeModel.isTurnAllowedBySegDirections(segmentModel, otherSegment)) {
                    return nodogleg;
                }
                if (otherSegment.attributes.roadType === 4) {
                    if (offramp) {
                        return nodogleg;
                    }
                    if (!otherSegment.isOneWay()) {
                        return nodogleg;
                    }
                    offramp = otherSegment;
                }
                else if (otherSegment.attributes.roadType === attr1.roadType) {
                    if (s2) {
                        return nodogleg;
                    }
                    if (!otherSegment.isOneWay()) {
                        return nodogleg;
                    }
                    s2 = otherSegment;
                }
                else {
                    return nodogleg;
                }
            }
            if (!s2 || !offramp) {
                return nodogleg;
            }
            return {
                isDoglegCandidate: true,
                s1: segmentModel,
                s2: s2,
                offramp: offramp,
                node: middleNodeModel
            };
        }
        function checkSegments(s = []) {
            for (let i = 0; i < s.length; i++) {
                let res = detectDoglegCandidate(s[i]);
                if (res.isDoglegCandidate === true) {
                    console.dir(res);
                    if (isDoglegValid(res, settings.energy_saving)) {
                        highlightDoglegSuccess(res);
                    }
                    else {
                        highlightDoglegFail(res);
                    }
                }
            }
        }
        function addLabel(feature) {
            wmeSDK.Map.addFeatureToLayer({
                feature: feature, layerName: "Falcon Eye Labels"
            });
        }
        function createLabel(text, point, xOffset = 0, yOffset = 0) {
            let convertedGeometry = W.userscripts.toGeoJSONGeometry(point).coordinates;
            return {
                geometry: {
                    coordinates: [convertedGeometry[0], convertedGeometry[1]],
                    type: "Point"
                },
                id: Date.now().toString(),
                properties: {
                    'label': text,
                    'xOffset': xOffset,
                    'yOffset': yOffset
                },
                type: "Feature"
            };
        }
        function highlightDogleg(dogleg, failure) {
            let style = failure ? warningStyle : successStyle;
            const reducedPointList = getS1Points(dogleg.s1);
            if (dogleg.angle1) {
                let labelFeature = createLabel(`_._: ${dogleg.angle1.toFixed(2)}°`, reducedPointList[1], 30, -30);
                addLabel(labelFeature);
            }
            if (dogleg.angle2) {
                let labelFeature = createLabel(`⑂: ${dogleg.angle2.toFixed(2)}°`, reducedPointList[1], 30, 30);
                addLabel(labelFeature);
            }
            let lineFeature = null;
            if (dogleg.s1_length) {
                lineFeature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(reducedPointList), null, errorStyle);
                let labelFeature = createLabel(`${dogleg.s1_length.toFixed(2)}m`, reducedPointList[0], 30, 30);
                addLabel(labelFeature);
            }
            else {
                lineFeature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(reducedPointList), null, style);
            }
            let reducedPointListRamp;
            try {
                reducedPointListRamp = getRampPoints(dogleg.offramp);
            }
            catch (e) {
                return;
            }
            let lineFeatureRamp = null;
            if (dogleg.delta) {
                let labelFeature = createLabel(`Δ: ${dogleg.delta.toFixed(2)}°`, reducedPointListRamp[0], 30, 30);
                addLabel(labelFeature);
            }
            if (dogleg.offramp_length) {
                lineFeatureRamp = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(reducedPointListRamp), null, errorStyle);
                let labelFeature = createLabel(`${dogleg.offramp_length.toFixed(2)}m`, reducedPointListRamp[0], -30, -30);
                addLabel(labelFeature);
            }
            else {
                lineFeatureRamp = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(reducedPointListRamp), null, style);
            }
            doglegLayer.addFeatures(Array.of(lineFeature, lineFeatureRamp));
        }
        function highlightDoglegSuccess(dogleg) {
            highlightDogleg(dogleg, false);
        }
        function highlightDoglegFail(dogleg) {
            highlightDogleg(dogleg, true);
        }
        function isDoglegValid(dog, shortcut = false) {
            if (shortcut) {
                return checkLengthOfIncomingSegment(dog) && lengthOfRampIsCorrect(dog) && checkAngle1(dog) && checkAngle2(dog) && checkDelta(dog);
            }
            let result = checkLengthOfIncomingSegment(dog);
            result = lengthOfRampIsCorrect(dog) && result;
            result = checkAngle1(dog) && result;
            result = checkAngle2(dog) && result;
            result = checkDelta(dog) && result;
            return result;
        }
        function computeDistance(p0, p1) {
            const ll1 = new OpenLayers.LonLat(p0.x, p0.y);
            const ll2 = new OpenLayers.LonLat(p1.x, p1.y);
            ll1.transform(OLWazeProjection, WorldGeodeticSystemProjection);
            ll2.transform(OLWazeProjection, WorldGeodeticSystemProjection);
            return 1000.0 * OpenLayers.Util.distVincenty(ll1, ll2);
        }
        function getRampPoints(ramp) {
            let p0, p1;
            const a = ramp.attributes;
            const g = a.geometry.getVertices();
            if (g.length < 3) {
                throw 'Ramp does not have enough subsegments.';
            }
            if (a.fwdDirection === true) {
                p0 = g[1];
                p1 = g[2];
            }
            else {
                p0 = g[g.length - 2];
                p1 = g[g.length - 3];
            }
            return [p0, p1];
        }
        function getS2Points(s2) {
            let p0, p1;
            const g = s2.attributes.geometry.getVertices();
            if (s2.attributes.fwdDirection === true) {
                p0 = g[0];
                p1 = g[1];
            }
            else {
                p0 = g[g.length - 1];
                p1 = g[g.length - 2];
            }
            return [p0, p1];
        }
        function getS1Points(s1) {
            let p0, p1;
            const g = s1.attributes.geometry.getVertices();
            if (s1.attributes.fwdDirection === true) {
                p0 = g[g.length - 2];
                p1 = g[g.length - 1];
            }
            else {
                p0 = g[1];
                p1 = g[0];
            }
            return [p0, p1];
        }
        function checkLengthOfIncomingSegment(dog) {
            let [p0, p1] = getS1Points(dog.s1);
            let distance = computeDistance(p0, p1);
            if (distance > INCOMING_MIN_LENGTH) {
                return true;
            }
            dog.s1_length = distance;
            return false;
        }
        function lengthOfRampIsCorrect(dog) {
            let p0, p1;
            try {
                [p0, p1] = getRampPoints(dog.offramp);
            }
            catch (e) {
                console.warn(e);
                return false;
            }
            let distance = computeDistance(p0, p1);
            if (distance > OFFRAMP_MIN_LENGTH) {
                return true;
            }
            dog.offramp_length = distance;
            return false;
        }
        function checkAngle1(dog) {
            let angle = Math.abs(ja_angle_diff(dog.node.getAngleToSegment(dog.s1), dog.node.getAngleToSegment(dog.s2)));
            if (angle > ANGLE1_MIN && angle < ANGLE1_MAX) {
                return true;
            }
            dog.angle1 = angle;
            return false;
        }
        function checkAngle2(dog) {
            let angle = Math.abs(ja_angle_diff(dog.node.getAngleToSegment(dog.s2), dog.node.getAngleToSegment(dog.offramp)));
            if (angle > ANGLE2_MIN && angle < ANGLE2_MAX) {
                return true;
            }
            dog.angle2 = angle;
            return false;
        }
        function checkDelta(dog) {
            let r0, r1;
            try {
                [r0, r1] = getRampPoints(dog.offramp);
            }
            catch (e) {
                console.warn(e);
                return false;
            }
            let angleRamp = Math.atan2(r1.y - r0.y, r1.x - r0.x) * One80DividedByPi;
            let [hw0, hw1] = getS2Points(dog.s2);
            let angleHw = Math.atan2(hw1.y - hw0.y, hw1.x - hw0.x) * One80DividedByPi;
            let delta = Math.abs(ja_angle_diff(angleHw, angleRamp));
            if (delta < DELTA_MAX) {
                return true;
            }
            dog.delta = delta;
            return false;
        }
        init();
    }

})();
