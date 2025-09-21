// ==UserScript==
// @name        WME Falcon Eye
// @namespace   bedo2991-waze
// @version     1.2.1
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
// ==/UserScript==

(function () {
  'use strict';

  // index.ts
  var earthRadius = 63710088e-1;
  var factors = {
    centimeters: earthRadius * 100,
    centimetres: earthRadius * 100,
    degrees: 360 / (2 * Math.PI),
    feet: earthRadius * 3.28084,
    inches: earthRadius * 39.37,
    kilometers: earthRadius / 1e3,
    kilometres: earthRadius / 1e3,
    meters: earthRadius,
    metres: earthRadius,
    miles: earthRadius / 1609.344,
    millimeters: earthRadius * 1e3,
    millimetres: earthRadius * 1e3,
    nauticalmiles: earthRadius / 1852,
    radians: 1,
    yards: earthRadius * 1.0936
  };
  function radiansToLength(radians, units = "kilometers") {
    const factor = factors[units];
    if (!factor) {
      throw new Error(units + " units is invalid");
    }
    return radians * factor;
  }
  function radiansToDegrees(radians) {
    const normalisedRadians = radians % (2 * Math.PI);
    return normalisedRadians * 180 / Math.PI;
  }
  function degreesToRadians(degrees) {
    const normalisedDegrees = degrees % 360;
    return normalisedDegrees * Math.PI / 180;
  }

  // index.ts
  function getCoord(coord) {
    if (!coord) {
      throw new Error("coord is required");
    }
    if (!Array.isArray(coord)) {
      if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
        return [...coord.geometry.coordinates];
      }
      if (coord.type === "Point") {
        return [...coord.coordinates];
      }
    }
    if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
      return [...coord];
    }
    throw new Error("coord must be GeoJSON Point or an Array of numbers");
  }

  // index.ts
  function bearing(start, end, options = {}) {
    if (options.final === true) {
      return calculateFinalBearing(start, end);
    }
    const coordinates1 = getCoord(start);
    const coordinates2 = getCoord(end);
    const lon1 = degreesToRadians(coordinates1[0]);
    const lon2 = degreesToRadians(coordinates2[0]);
    const lat1 = degreesToRadians(coordinates1[1]);
    const lat2 = degreesToRadians(coordinates2[1]);
    const a = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const b = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return radiansToDegrees(Math.atan2(a, b));
  }
  function calculateFinalBearing(start, end) {
    let bear = bearing(end, start);
    bear = (bear + 180) % 360;
    return bear;
  }

  // index.ts
  function distance(from, to, options = {}) {
    var coordinates1 = getCoord(from);
    var coordinates2 = getCoord(to);
    var dLat = degreesToRadians(coordinates2[1] - coordinates1[1]);
    var dLon = degreesToRadians(coordinates2[0] - coordinates1[0]);
    var lat1 = degreesToRadians(coordinates1[1]);
    var lat2 = degreesToRadians(coordinates2[1]);
    var a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
    return radiansToLength(
      2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
      options.units
    );
  }

  var FalconLayer;
  (function (FalconLayer) {
      FalconLayer["Segments"] = "Falcon Eye";
      FalconLayer["Labels"] = "Falcon Eye Labels";
  })(FalconLayer || (FalconLayer = {}));
  window.SDK_INITIALIZED.then(initScript);
  function initScript() {
      if (!window.getWmeSdk) {
          throw new Error("SDK not available");
      }
      const wmeSDK = window.getWmeSdk({
          scriptId: "wme-falcon-eye",
          scriptName: "WME Falcon Eye"
      });
      console.debug(`SDK v. ${wmeSDK.getSDKVersion()} on ${wmeSDK.getWMEVersion()} initialized`);
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
              layerName: FalconLayer.Segments,
              styleRules: [
                  {
                      style: {
                          pointerEvents: 'none',
                          strokeColor: '#00ff00',
                          strokeWidth: 25,
                          strokeOpacity: 0.5,
                          strokeDashstyle: 'solid',
                          strokeLinecap: 'butt',
                      },
                  },
                  {
                      predicate: (featureProperties) => !!featureProperties.isError,
                      style: {
                          pointerEvents: 'none',
                          strokeColor: '#ff0000',
                          strokeWidth: 25,
                          strokeOpacity: 0.5,
                          strokeDashstyle: 'solid',
                          strokeLinecap: 'butt',
                      },
                  },
                  {
                      predicate: (featureProperties) => !!featureProperties.isWarning,
                      style: {
                          pointerEvents: 'none',
                          strokeColor: '#9932CC',
                          strokeWidth: 25,
                          strokeOpacity: 0.5,
                          strokeDashstyle: 'solid',
                          strokeLinecap: 'butt',
                      },
                  },
              ]
          });
          wmeSDK.Map.addLayer({
              layerName: FalconLayer.Labels,
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
                          'graphic': false,
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
      const ANGLE1_MIN = 170.0;
      const ANGLE1_MAX = 190.0;
      const ANGLE2_MIN = 20.0;
      const ANGLE2_MAX = 55.0;
      const OFFRAMP_MIN_LENGTH = 12.0;
      const INCOMING_MIN_LENGTH = 12.0;
      const DELTA_MAX = 10.0;
      async function init() {
          loadSettings();
          addLayers();
          manageStateChange();
          setUpLeftPanel();
          waitForWazeWrap().then((result) => {
              if (result === true) {
                  initWazeWrapElements();
              }
          });
          startCheck();
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
              options.forEach((o) => {
                  const option = document.createElement('option');
                  option.text = o;
                  option.value = o;
                  newSelect.add(option);
              });
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
          if (!div)
              return;
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
          updateSettingsUI();
          addSettingsEventListeners();
          if (settings.script_enabled) {
              if (wmeSDK.Map.getZoomLevel() >= settings.check_from_zoom) {
                  setScriptStatus(States.enabled);
              }
              else {
                  setScriptStatus(States.zoom_disabled);
              }
          }
          else {
              setScriptStatus(States.disabled);
          }
      }
      function applyDefaultValues() {
          setSettingsDefaultValues();
          updateSettingsUI();
      }
      function updateSettingsUI() {
          const enableEl = document.getElementById("dog_enable");
          const energyEl = document.getElementById("dog_energy");
          const zoomEl = document.getElementById("dog_zoom");
          if (enableEl)
              enableEl.checked = settings.script_enabled;
          if (energyEl)
              energyEl.checked = settings.energy_saving;
          if (zoomEl)
              zoomEl.value = String(settings.check_from_zoom);
      }
      function addSettingsEventListeners() {
          const enableEl = document.getElementById("dog_enable");
          const energyEl = document.getElementById("dog_energy");
          const zoomEl = document.getElementById("dog_zoom");
          if (enableEl)
              enableEl.addEventListener("click", toggleEnableCheckbox);
          if (energyEl)
              energyEl.addEventListener("click", toggleEnergySavingCheckbox);
          if (zoomEl)
              zoomEl.addEventListener("change", zoomSettingChanged);
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
              console.log("Falcon Eye running for the first time in this browser");
              applyDefaultValues();
              return;
          }
          const storedSettings = JSON.parse(loadedSettings);
          if (!storedSettings) {
              console.warn("Falcon Eye: setting found, but could not parse them.");
              console.log("Falcon Eye running for the first time in this browser");
              applyDefaultValues();
              return;
          }
          console.log("Falcon Eye: loading settings from the local storage.");
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
          if (settings.script_enabled) {
              startCheck();
          }
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
          settings.energy_saving = e.target.checked;
          safeAlert(AlertType.INFO, settings.energy_saving ? "The script will stop looking for problems after finding the first one" : "The script will show all doglegs problems at once");
          storeSettings();
      }
      function initWazeWrapElements() {
          WazeWrap.Interface.ShowScriptUpdate(SCRIPT_NAME, SCRIPT_VERSION, `<b>What's new?</b>
            <ul>
            <li>1.2.1: Fix for inaccurate angle computation after moving to the SDK. Better handling of the settings states</li>
            <li>1.1.1: Use the new WME SDK.</li>
            <li>1.0.0: Use the new WME API, store the settings when they get changed.</li>
            <li>0.0.9.5: The checkbox to disable the script now really disables the script. It is possible to select from what zoom level the script should work. The script state gets displayed in the script's panel.</li>
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
                  console.log('DOG: WazeWrap not ready, retrying in 800ms');
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
          console.debug("Events initialization");
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
          wmeSDK.Map.removeAllFeaturesFromLayer({
              layerName: FalconLayer.Segments
          });
          wmeSDK.Map.removeAllFeaturesFromLayer({
              layerName: FalconLayer.Labels
          });
      }
      function startCheck() {
          clearAll();
          if (wmeSDK.Map.getZoomLevel() >= settings.check_from_zoom) {
              setScriptStatus(States.enabled);
              checkSegments(wmeSDK.DataModel.Segments.getAll());
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
      function detectDoglegCandidate(s1) {
          console.debug("Checking the given segment: " + s1.id);
          const nodogleg = { isDoglegCandidate: false };
          if (!s1) {
              console.warn("Segment S1 not found");
              return nodogleg;
          }
          let s2Sdk = null;
          let offrampSdk = null;
          if (s1.isTwoWay) {
              return nodogleg;
          }
          let roadType1 = s1.roadType;
          let expectedRoadTypes = [3, 6, 7];
          if (!expectedRoadTypes.includes(roadType1)) {
              return nodogleg;
          }
          if (s1.junctionId !== null) {
              return nodogleg;
          }
          let middleNodeSdk = null;
          if (s1.isAtoB && s1.toNodeId) {
              middleNodeSdk = wmeSDK.DataModel.Nodes.getById({
                  nodeId: s1.toNodeId
              });
          }
          else {
              if (s1.fromNodeId) {
                  middleNodeSdk = wmeSDK.DataModel.Nodes.getById({
                      nodeId: s1.fromNodeId
                  });
              }
          }
          if (!middleNodeSdk) {
              return nodogleg;
          }
          const connectedSegmentsIDs = middleNodeSdk.connectedSegmentIds;
          if (connectedSegmentsIDs.length !== 3) {
              return nodogleg;
          }
          console.debug("Checking connections");
          for (let i = 0; i < connectedSegmentsIDs.length; i++) {
              if (connectedSegmentsIDs[i] === s1.id) {
                  continue;
              }
              const otherSegmentSdk = wmeSDK.DataModel.Segments.getById({
                  segmentId: connectedSegmentsIDs[i]
              });
              if (!otherSegmentSdk)
                  continue;
              if (!wmeSDK.DataModel.Turns.isTurnAllowedBySegmentDirections({
                  fromSegmentId: s1.id,
                  toSegmentId: connectedSegmentsIDs[i],
                  nodeId: middleNodeSdk.id
              })) {
                  console.debug("Connection is not allowed, skipping...");
                  return nodogleg;
              }
              console.debug("Setting the other 2 segments");
              if (otherSegmentSdk.roadType === 4) {
                  console.debug("Segment is a ramp");
                  if (offrampSdk) {
                      return nodogleg;
                  }
                  if (otherSegmentSdk.isTwoWay) {
                      return nodogleg;
                  }
                  offrampSdk = otherSegmentSdk;
              }
              else if (otherSegmentSdk.roadType === s1.roadType) {
                  console.debug("Segment is S2");
                  if (s2Sdk) {
                      return nodogleg;
                  }
                  if (otherSegmentSdk.isTwoWay) {
                      return nodogleg;
                  }
                  s2Sdk = otherSegmentSdk;
              }
              else {
                  console.debug("Segment is invalid");
                  return nodogleg;
              }
          }
          if (!s2Sdk || !offrampSdk) {
              console.info("Dogleg almost detected...");
              return nodogleg;
          }
          console.debug("Segment is S1 of a dogleg");
          return {
              isDoglegCandidate: true,
              s1Id: s1.id,
              s2Id: s2Sdk.id,
              offrampId: offrampSdk.id,
              nodeId: middleNodeSdk.id,
          };
      }
      function checkSegments(s = []) {
          console.debug("Checking the given segments");
          for (let i = 0; i < s.length; i++) {
              let res = detectDoglegCandidate(s[i]);
              if (res.isDoglegCandidate === true) {
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
              feature: feature, layerName: FalconLayer.Labels
          });
      }
      function createLabel(text, point, xOffset = 0, yOffset = 0) {
          return {
              geometry: {
                  coordinates: [point[0], point[1]],
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
      function createLineFeature({ geometry, properties }) {
          return {
              geometry: {
                  coordinates: geometry,
                  type: "LineString"
              },
              id: Date.now().toString(),
              properties: properties,
              type: "Feature"
          };
      }
      function highlightDogleg(dogleg, failure) {
          console.debug("Highlight");
          const reducedPointList = getS1Points(dogleg.s1Id);
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
              lineFeature = createLineFeature({
                  geometry: reducedPointList,
                  properties: { isError: true }
              });
              let labelFeature = createLabel(`${dogleg.s1_length.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}m`, reducedPointList[0], 30, 30);
              addLabel(labelFeature);
          }
          else {
              lineFeature = createLineFeature({
                  geometry: reducedPointList,
                  properties: { isWarning: !!failure }
              });
          }
          let reducedPointListRamp;
          try {
              reducedPointListRamp = getRampPoints(dogleg.offrampId);
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
              lineFeatureRamp = createLineFeature({
                  geometry: reducedPointListRamp,
                  properties: { isError: true }
              });
              let labelFeature = createLabel(`${dogleg.offramp_length.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}m`, reducedPointListRamp[0], -30, -30);
              addLabel(labelFeature);
          }
          else {
              lineFeatureRamp = createLineFeature({
                  geometry: reducedPointListRamp,
                  properties: { isWarning: !!failure }
              });
          }
          wmeSDK.Map.addFeaturesToLayer({
              features: [lineFeature, lineFeatureRamp],
              layerName: FalconLayer.Segments
          });
      }
      function highlightDoglegSuccess(dogleg) {
          console.debug("Highlight success");
          highlightDogleg(dogleg, false);
      }
      function highlightDoglegFail(dogleg) {
          console.debug("Highlight false");
          highlightDogleg(dogleg, true);
      }
      function isDoglegValid(dog, shortcut = false) {
          if (shortcut) {
              return checkLengthOfIncomingSegment(dog) && checkLengthOfRampIsCorrect(dog) && checkAngle1(dog) && checkAngle2(dog) && checkDelta(dog);
          }
          let result = checkLengthOfIncomingSegment(dog);
          result = checkLengthOfRampIsCorrect(dog) && result;
          result = checkAngle1(dog) && result;
          result = checkAngle2(dog) && result;
          result = checkDelta(dog) && result;
          return result;
      }
      function computeDistanceInMeters(p0, p1) {
          return distance(p0, p1, { units: 'meters' });
      }
      function getRampPoints(rampId) {
          let p0, p1;
          const ramp = wmeSDK.DataModel.Segments.getById({
              segmentId: rampId
          });
          const g = ramp?.geometry.coordinates;
          if (!g)
              throw "Geometry not found";
          if (g.length < 3) {
              throw 'Ramp does not have enough subsegments.';
          }
          if (ramp.isAtoB) {
              p0 = g[1];
              p1 = g[2];
          }
          else {
              p0 = g[g.length - 2];
              p1 = g[g.length - 3];
          }
          return [p0, p1];
      }
      function getRampGeoPoints(rampId) {
          let p0, p1;
          const ramp = wmeSDK.DataModel.Segments.getById({
              segmentId: rampId
          });
          const g = ramp?.geometry.coordinates;
          if (!g)
              throw "Geometry not found";
          if (g.length < 3) {
              throw 'Ramp does not have enough subsegments.';
          }
          if (ramp.isAtoB) {
              p0 = g[1];
              p1 = g[2];
          }
          else {
              p0 = g[g.length - 2];
              p1 = g[g.length - 3];
          }
          return [p0, p1];
      }
      function getS2GeoPoints(s2Id) {
          let p0, p1;
          const s2 = wmeSDK.DataModel.Segments.getById({
              segmentId: s2Id
          });
          const g = s2?.geometry.coordinates;
          if (!g)
              throw "Geometry not found";
          if (s2?.isAtoB) {
              p0 = g[0];
              p1 = g[1];
          }
          else {
              p0 = g[g.length - 1];
              p1 = g[g.length - 2];
          }
          return [p0, p1];
      }
      function getS1Points(segId) {
          const s1 = wmeSDK.DataModel.Segments.getById({
              segmentId: segId
          });
          if (!s1)
              throw "Segment S1 not found";
          const line = s1.geometry;
          const g = line.coordinates;
          let p0, p1;
          if (s1.isAtoB) {
              p0 = g[g.length - 2];
              p1 = g[g.length - 1];
          }
          else {
              p0 = g[1];
              p1 = g[0];
          }
          return [p0, p1];
      }
      function getS1GeoPoints(segmentId) {
          let p0, p1;
          const s1 = wmeSDK.DataModel.Segments.getById({
              segmentId: segmentId
          });
          const g = s1?.geometry.coordinates;
          if (!g)
              throw "Geometry not found";
          if (s1?.isAtoB) {
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
          if (!dog.s1Id)
              throw "Could not find the offramp id";
          let [p0, p1] = getS1GeoPoints(dog.s1Id);
          let distance = computeDistanceInMeters(p0, p1);
          console.debug("Length S1: " + distance);
          if (distance > INCOMING_MIN_LENGTH) {
              return true;
          }
          dog.s1_length = distance;
          return false;
      }
      function checkLengthOfRampIsCorrect(dog) {
          let p0, p1;
          const offRampId = dog.offrampId;
          if (!offRampId)
              throw "Could not find the offramp id";
          try {
              [p0, p1] = getRampGeoPoints(offRampId);
          }
          catch (e) {
              console.warn(e);
              return false;
          }
          let distance = computeDistanceInMeters(p0, p1);
          console.debug("Offramp length: " + distance);
          if (distance > OFFRAMP_MIN_LENGTH) {
              return true;
          }
          dog.offramp_length = distance;
          return false;
      }
      function getAngleToSegment(nodeId, segmentId) {
          const segment = wmeSDK.DataModel.Segments.getById({
              segmentId: segmentId
          });
          if (!segment) {
              throw "Segment not found";
          }
          const s = segment.geometry.coordinates;
          let t, n;
          if (segment.fromNodeId === nodeId) {
              t = s[0];
              n = s[1];
          }
          else if (segment.toNodeId === nodeId) {
              t = s[s.length - 1];
              n = s[s.length - 2];
          }
          else {
              throw "Node is not connected to the segment";
          }
          const bearing$1 = bearing(t, n);
          let angle = bearing$1;
          if (angle < 0)
              angle = 360 + angle;
          console.debug(`Angle to segment (nodeId: ${nodeId}, segmentId: ${segmentId}): ${angle}`);
          return angle;
      }
      function checkAngle1(dog) {
          let angle = Math.abs(ja_angle_diff(getAngleToSegment(dog.nodeId, dog.s1Id), getAngleToSegment(dog.nodeId, dog.s2Id)));
          console.debug("Angle 1: " + angle);
          if (angle > ANGLE1_MIN && angle < ANGLE1_MAX) {
              return true;
          }
          dog.angle1 = angle;
          return false;
      }
      function checkAngle2(dog) {
          let angle = Math.abs(ja_angle_diff(getAngleToSegment(dog.nodeId, dog.s2Id), getAngleToSegment(dog.nodeId, dog.offrampId)));
          console.debug("Angle 2: " + angle);
          if (angle > ANGLE2_MIN && angle < ANGLE2_MAX) {
              return true;
          }
          dog.angle2 = angle;
          return false;
      }
      function checkDelta(dog) {
          let r0, r1;
          if (!dog.offrampId || !dog.s2Id) {
              throw "Could not find the offramp or s2 id";
          }
          try {
              [r0, r1] = getRampGeoPoints(dog.offrampId);
          }
          catch (e) {
              console.warn(e);
              return false;
          }
          let angleRamp = Math.atan2(r1[1] - r0[1], r1[0] - r0[0]) * One80DividedByPi;
          console.debug("angleRamp: " + angleRamp);
          let [hw0, hw1] = getS2GeoPoints(dog.s2Id);
          let angleHw = Math.atan2(hw1[1] - hw0[1], hw1[0] - hw0[0]) * One80DividedByPi;
          console.debug("angleHw: " + angleHw);
          let delta = Math.abs(ja_angle_diff(angleHw, angleRamp));
          console.debug("Delta: " + delta);
          if (delta < DELTA_MAX) {
              return true;
          }
          dog.delta = delta;
          return false;
      }
      init();
  }

})();
