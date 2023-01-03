// ==UserScript==
// @name         WME Falcon Eye
// @namespace    bedo2991-waze
// @version      0.0.9.5
// @description  validates doglegs for Falcon
// @author       bedo2991
// @updateURL    https://github.com/bedo2991/wme-falcon-eye/releases/latest/download/wme-falcon-eye.user.js
// @downloadURL  https://github.com/bedo2991/wme-falcon-eye/releases/latest/download/wme-falcon-eye.user.js
// @match            https://*.waze.com/editor*
// @match            https://*.waze.com/*/editor*
// @exclude          https://www.waze.com/*/user/editor*
// @exclude          https://www.waze.com/user/editor*
// @require    https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=waze.com
// @grant        none
// @copyright  2022+, bedo2991
// @website https://docs.google.com/document/d/16p3AQg5-7HM-fz92ykkAipADnO3Aw2j3oCLCNmOml5c/edit?usp=sharing
// ==/UserScript==

/* global W, OpenLayers, WazeWrap */

(function() {
    'use strict';

    /** @type {string} */
    const SCRIPT_VERSION = GM_info.script.version;
    const SCRIPT_NAME = GM_info.script.name;
    const SCRIPT_SHORT_NAME = "dog";

    const One80DividedByPi = 180.0 / Math.PI;

    let OLWazeProjection = null;
    let WorldGeodeticSystemProjection = null;

    let energy_saving_enabled = true;
    let checkFromZoom = 17;

    const ANGLE1_MIN = 170.0;
    const ANGLE1_MAX = 190.0;

    const ANGLE2_MIN = 20.0;
    const ANGLE2_MAX = 55.0;

    const OFFRAMP_MIN_LENGTH = 12.0;

    const INCOMING_MIN_LENGTH = 12.0;

    const DELTA_MAX = 10.0;

    const safeAlert = (level, message) => {
        try {
            WazeWrap.Alerts[level](GM_info.script.name, message);
        } catch (e) {
            console.error(e);
            alert(message);
        }
    };

    const warningStyle = {
        'pointerEvents': 'none',
        'strokeColor': '#9932CC',
        'strokeWidth': 25,
        'strokeOpacity': 0.5,
        'strokeDashstyle': 'solid',
        'strokeLinecap': 'butt',
    };

    let labelStyleMap = null;

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

    let errors = [];
    let doglegLayer = null;
    let doglegLabelsLayer = null;

    function init(){
        waitForWazeWrap().then((result) => {
            if (result === true) {
                initWazeWrapElements();
                initOpenLayersElements();
                initDoglegLayer();
                initEvents();
            }
        });
    }

    function initOpenLayersElements(){
        OLWazeProjection = W.map.getOLMap().projection;
        WorldGeodeticSystemProjection = new OpenLayers.Projection('EPSG:4326');
    }

    function createInput({ id, type, className, title, min, max, step }) {
        const input = document.createElement('input');
        input.id = 'dog_' + id;
        if (className) {
            input.className = className;
        }
        if (title) {
            input.title = title;
        }
        input.type = type;
        if (type === 'range' || type === 'number') {
            input.min = min;
            input.max = max;
            input.step = step;
        }
        return input;
    }

    function createCheckboxOption({ id, title, description}) {
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
        if(typeof options[0] === "object"){
      options.forEach((o) => {
        const option = document.createElement('option');
        option.text = o.text;
        option.value = o.value;
        newSelect.add(option);
      });
        } else {
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
   /**
   * TODO: make as a library
   * @param {{id:string,title:string,description:string,min:number,max:number,step:(number|undefined),isNew:(string|undefined)}} param0
   */
  function createRangeOption({
    id,
    title,
    description,
    min,
    max,
    step,
    isNew,
  }) {
    const line = document.createElement('div');
    line.className = 'prefLineSlider';
    if (typeof isNew === 'string') {
      line.classList.add('newOption');
      line.dataset.version = isNew;
    }
    const label = document.createElement('label');
    label.innerText = title;

    const input = createInput({
      id,
      min,
      max,
      step,
      title: 'Pick a value',
      className: 'prefElement form-control',
      type: 'range',
    });

    label.appendChild(input);
    line.appendChild(label);

    if (description) {
      const i = document.createElement('i');
      i.innerText = description;
      line.appendChild(i);
    }

    return line;
  }

    function setScriptStatus(state){
    const div = document.getElementById("dog_script_state");
        switch(state){
            case "ENABLED":
            div.innerText = "✅";
            break;
            case "DISABLED":
            div.innerText = "🛑";
            break;
            case "ZOOM_STOPPED":
            div.innerText = "🔍🔙";
            break;
            default:
                alert("DOG: Invalid state");
        }
    }

    function setUpLeftPanel() {
        const mainDiv = document.createElement('div');

        const title = document.createElement('h4');
        title.innerText = SCRIPT_NAME;
        mainDiv.appendChild(title);

        const spanVersion = document.createElement('span');
        spanVersion.innerText = `Version ${SCRIPT_VERSION}`;
        mainDiv.appendChild(spanVersion);

        const divStatus = document.createElement('div');
        divStatus.id = "dog_script_state";
        divStatus.style.float="right";
        mainDiv.appendChild(divStatus);

        // Checkbox Enable or disable the check

        let enableCB = createCheckboxOption({id:"enable",
                                             title: "Script enabled",
                                             description: "When checked, segments get analysed for doglegs"});
        mainDiv.appendChild(enableCB);

        let energyCB = createCheckboxOption({id:"energy",
                                             title: "Energy saving",
                                             description: "When checked, the segment verification stops as soon as a problem has been found."});
        mainDiv.appendChild(energyCB);

        let zoomRange = createDropdownOption({id:"zoom", title:"Enabled from zoom", description:"The script only scans the map from the given zoom", options:[14,15,16,17,18,19,20,21,22]});
        mainDiv.appendChild(zoomRange);


        // Checkbox Energy saver mode


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

        let ignored = new WazeWrap.Interface.Tab(
            '🐦',
            mainDiv.innerHTML,
            null // callback
        );

        applyDefaultValues();
        addSettingsEventListeners();
    }

    function applyDefaultValues(){
        document.getElementById("dog_enable").checked=true;
        document.getElementById("dog_energy").checked=energy_saving_enabled;
        document.getElementById("dog_zoom").value=checkFromZoom;
        setScriptStatus("ENABLED");
    }

    function addSettingsEventListeners(){
        document.getElementById("dog_enable").addEventListener("click", toggleEnableCheckbox);
        document.getElementById("dog_energy").addEventListener("click", toggleEnergySavingCheckbox);
        document.getElementById("dog_zoom").addEventListener("change", zoomSettingChanged);
    }

    function zoomSettingChanged(e){
        checkFromZoom = parseInt(e.target.value);
    }

    function toggleEnableCheckbox(e){
        if(e.target.checked){
            removeEvents();
            initEvents();
            setScriptStatus("ENABLED");
        }else{
            // Script was disabled
            removeEvents();
            clearAll();
            setScriptStatus("DISABLED");
        }
    }

    function toggleEnergySavingCheckbox(e){
        energy_saving_enabled = e.target.checked;
        safeAlert('info', energy_saving_enabled?"The script will stop looking for problems after finding one":"The script will show all doglegs problems at once");
    }

    function initWazeWrapElements(){
        WazeWrap.Interface.ShowScriptUpdate(
            SCRIPT_NAME,
            SCRIPT_VERSION,
            `<b>What's new?</b>
            <ul>
            <li>0.0.9.5: The checkbox to disable the script now really disables the script. It is possible to select from what zoom level the script should work. The script state gets displayed in the script's panel.</li>
            <li>0.0.9.3: Fixes a problem with zoom while a segment is selected</li>
            <li>0.0.9.2: Fixes a problem when a ramp does not have enough geonodes</li>
            <li>0.0.7: Use realsize distance (take Earth curvature into consideration)</li>
            </ul>`,
            "",
            GM_info.script.supportURL
        );
        setUpLeftPanel();
    }

    async function waitForWazeWrap() {
        let trials = 1;
        let sleepTime = 150;
        do {
            if (
                !WazeWrap ||
                !WazeWrap.Ready ||
                !WazeWrap.Interface ||
                !WazeWrap.Alerts
            ) {
                console.log('DOG: WazeWrap not ready, retrying in 800ms');
                await sleep(trials * sleepTime);
            } else {
                return true;
            }
        } while (trials++ <= 30);
        console.error('DOG: could not initialize WazeWrap');
        throw new Error('DOG: could not initialize WazeWrap');
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function removeEvents(){
        W.model.events.unregister('mergeend', null, startCheck);
    }

    function initEvents(){
        console.debug("Events initialization");
        W.model.events.register('mergeend', null, startCheck);

        const events = W.model.segments._events;
        if (typeof events === 'object') {
            events.objectschanged.push({
                'callback': startCheck
            });
        }

        startCheck();
    }


    function clearAll(){
        clearLayer();
        clearLabelLayer();
        clearErrors();
    }

    function clearErrors(){
        errors = [];
    }

    function clearLabelLayer(){
        doglegLabelsLayer.destroyFeatures(null, { 'silent': true });
    }

    function clearLayer(){
        doglegLayer.destroyFeatures(null, { 'silent': true });
    }

    function startCheck(){
        clearAll();
        if(W.map.getZoom() >= checkFromZoom) {
            setScriptStatus("ENABLED");
            checkSegments(Object.values(W.model.segments.objects));
        }else{
            setScriptStatus("ZOOM_STOPPED");
        }
    }

    /**
     * Source: JAI
	 * get absolute (or turn) angle between 2 inputs.
	 * 0,90,true	-> 90	0,90,false	-> -90
	 * 0,170,true	-> 170	0,170,false	-> -10
	 * @param aIn absolute s_in angle (from node)
	 * @param aOut absolute s_out angle (from node)
	 * @param absolute return absolute or turn angle?
	 * @returns {number}
	 */
    function ja_angle_diff(aIn, aOut, absolute=true) {
        let a = aOut - aIn;
        if(a > 180.0) { a -= 360.0; }
        if(a < -180.0) { a+= 360.0; }
        return absolute ? a : (a > 0.0 ? a - 180.0 : a + 180.0);
    }

    function initDoglegLayer(){
        console.debug("Layer init");
        labelStyleMap = new OpenLayers.StyleMap( {
            'fontFamily': 'Rubik, Open Sans, Alef, helvetica, sans-serif',
            'label': "${label}",
            'labelYOffset': "${xOffset}",
            'labelXOffset': "${yOffset}",
            'fontColor': '#f00',
            'fontSize': 30,
            'fontWeight': "800",
            'labelOutlineColor': '#4B0082',
            'labelOutlineWidth': 2,
            'pointerEvents': 'none',
            'labelAlign': 'cm', // set to center middle
            'visibility':true,
        });
        doglegLayer = new OpenLayers.Layer.Vector("dogleg_layer", {
            'visibility': true
        });
        doglegLabelsLayer = new OpenLayers.Layer.Vector("dogleg_labels_layer", {
            'visibility': true,
            'isVector': true,
            'styleMap':labelStyleMap
        });

        W.map.getOLMap().addLayer(doglegLayer);
        W.map.getOLMap().addLayer(doglegLabelsLayer);
    }

    // This function checks if a given segment is a dogleg candidate
    // We consider a dogleg candidate a one-way highway segment (freeway, major or minor)
    // Leading to a node with one off-ramp segment and another highway segment of the same type
    // Consider if the name equality of the highway should also be checked)
    function detectDoglegCandidate(segmentModel) {
        console.debug("Checking the given segment: " + segmentModel.attributes.id);
        const nodogleg = {isDoglegCandidate:false};
        let s2 = null;
        let offramp = null;

        // Check if s1 is one-way
        if(!segmentModel.isOneWay()){
            return nodogleg;
        }

        const attr1 = segmentModel.attributes;

        // Check if s1 is a highway
        let roadType1 = attr1.roadType;

        if(![3,6,7].includes(roadType1)){
            return nodogleg;
        }

        // Check that s1 is not a roundabout
        if(attr1.junctionID !== null){
            return nodogleg;
        }

        // get the "to" node of thisSegment
        let middleNodeModel = null;
        if(attr1.fwdDirection){
            middleNodeModel = W.model.nodes.getObjectById(attr1.toNodeID)
        }
        else{
            middleNodeModel = W.model.nodes.getObjectById(attr1.fromNodeID)
        }

        if(!middleNodeModel) {
            // This happens when drawing a new segment
            return nodogleg;
        }

        // Check if there are exactly 2 other segments connected to the "to" node
        const connectedSegmentsIDs = middleNodeModel.getSegmentIds();
        if (connectedSegmentsIDs.length!==3){
            return nodogleg;
        }

        // Check that it is possible to go from the first segment to both other 2 segments
        console.debug("Checking connections");
        for(let i=0; i< connectedSegmentsIDs.length; i++){
            if(connectedSegmentsIDs[i] === attr1.id){
                continue;
            }
            let otherSegment = W.model.segments.getObjectById(connectedSegmentsIDs[i]);
            if(!middleNodeModel.isTurnAllowedBySegDirections(segmentModel, otherSegment))
            {
                console.debug("Connection is not allowed, skipping...");
                return nodogleg;
            }
            console.debug("Setting the other 2 segments");
            if(otherSegment.attributes.roadType === 4){
                console.debug("Segment is a ramp");
                if(offramp)
                {
                    return nodogleg;
                }
                // The ramp must be one-way
                if(!otherSegment.isOneWay()) {
                    return nodogleg;
                }
                offramp = otherSegment;
            }
            else if(otherSegment.attributes.roadType === attr1.roadType)
            {
                console.debug("Segment is S2");
                if(s2){
                    return nodogleg;
                }
                // S2 must be one-way
                if(!otherSegment.isOneWay()) {
                    return nodogleg;
                }
                s2 = otherSegment;
            }else{
                console.debug("Segment is invalid");
                return nodogleg;
            }
        }

        if(!s2 || !offramp) {
            console.warn("Dogleg almost detected...");
            return nodogleg;
        }

        console.debug("Segment is S1 of a dogleg");
        return {isDoglegCandidate:true,
                s1:segmentModel,
                s2 : s2,
                offramp : offramp,
                node: middleNodeModel};
    }

    function checkSegments(s=[]) {
        console.debug("Checking the given segments");
        for(let i=0; i<s.length; i++) {
            let res = detectDoglegCandidate(s[i]);
            if(res.isDoglegCandidate === true) {
                console.dir(res);
                if(isDoglegValid(res, energy_saving_enabled)){
                    highlightDoglegSuccess(res);
                }else{
                    highlightDoglegFail(res);
                }
            }
        }
    }

    function addLabel(feature){
        doglegLabelsLayer.addFeatures(Array.of(feature), {'silent':true});
    }

    function createLabel(text, point, xOffset=0, yOffset=0){
        return new OpenLayers.Feature.Vector(point.clone(), {
            'label' : text,
            'xOffset' : xOffset,
            'yOffset' : yOffset
        });
    }


    function highlightDogleg(dogleg, failure){
        console.debug("Highlight");
        let style = failure ? warningStyle : successStyle;

        const reducedPointList = getS1Points(dogleg.s1);

        if(dogleg.angle1){
            let labelFeature = createLabel(`_._: ${dogleg.angle1.toFixed(2)}°`, reducedPointList[1], 30, -30);
            addLabel(labelFeature);
        }

        if(dogleg.angle2){
            let labelFeature = createLabel(`⑂: ${dogleg.angle2.toFixed(2)}°`, reducedPointList[1], 30, 30);
            addLabel(labelFeature);
        }
        let lineFeature = null;
        if(dogleg.s1_length) {
            lineFeature = new OpenLayers.Feature.Vector(
                new OpenLayers.Geometry.LineString(reducedPointList), null, errorStyle);
            let labelFeature = createLabel(`${dogleg.s1_length.toFixed(2)}m`, reducedPointList[0], 30, 30);
            addLabel(labelFeature);
        }else {
            lineFeature = new OpenLayers.Feature.Vector(
                new OpenLayers.Geometry.LineString(reducedPointList), null, style);
        }


        let reducedPointListRamp;
        try{
            reducedPointListRamp = getRampPoints(dogleg.offramp);
        }
        catch(e){
            //The ramp does not have enough geo nodes.
            return;
        }
        let lineFeatureRamp = null;
        if(dogleg.delta){
            let labelFeature = createLabel(`Δ: ${dogleg.delta.toFixed(2)}°`, reducedPointListRamp[0], 30, 30);
            addLabel(labelFeature);
        }
        if(dogleg.offramp_length){
            lineFeatureRamp = new OpenLayers.Feature.Vector(
                new OpenLayers.Geometry.LineString(reducedPointListRamp), null, errorStyle);
            let labelFeature = createLabel( `${dogleg.offramp_length.toFixed(2)}m`, reducedPointListRamp[0], -30, -30);
            addLabel(labelFeature);
        }else{
            lineFeatureRamp = new OpenLayers.Feature.Vector(
                new OpenLayers.Geometry.LineString(reducedPointListRamp), null, style);
        }
        doglegLayer.addFeatures(Array.of(lineFeature, lineFeatureRamp));
    }

    function highlightDoglegSuccess(dogleg){
        console.debug("Highlight success");
        highlightDogleg(dogleg, false);
    }

    function highlightDoglegFail(dogleg){
        console.debug("Highlight false");
        highlightDogleg(dogleg, true);
    }

    /***
    Checks if the given dogleg is correct and will be used nicely by Falcon
    @return {boolean}
    */
    function isDoglegValid(dog, shortcut=false) {
        if(shortcut) {
            return checkLengthOfIncomingSegment(dog) && lengthOfRampIsCorrect(dog) && checkAngle1(dog) && checkAngle2(dog) && checkDelta(dog);
        }

        let result = checkLengthOfIncomingSegment(dog);
        //N.B. using &&= is not the same!
        result = lengthOfRampIsCorrect(dog) && result;
        result = checkAngle1(dog) && result;
        result = checkAngle2(dog) && result;
        result = checkDelta(dog) && result;
        return result;
    }

    // Returns the distance in meter between the points p0 and p1
    function computeDistance(p0, p1) {
        const ll1 = new OpenLayers.LonLat(p0.x, p0.y);
        const ll2 = new OpenLayers.LonLat(p1.x, p1.y);
        ll1.transform(OLWazeProjection, WorldGeodeticSystemProjection);
        ll2.transform(OLWazeProjection, WorldGeodeticSystemProjection);
        return 1000.0 * OpenLayers.Util.distVincenty(ll1, ll2); // result is in km, * 1000 to have it in m
        //return p0.distanceTo(p1); <- Replace with this to have a more efficient map coordinates distance
    }

    function addError(error){
        console.error(error);
        errors.push(error);
    }

    //Returns [p0, p1] of the second subsegment starting from the middleNode
    function getRampPoints(ramp){
        let p0,p1;
        const a = ramp.attributes;
        const g = a.geometry.getVertices();
        // What do you do if the offramp does not have a second subsegment?
        if(g.length < 3) {
            throw 'Ramp does not have enough subsegments.';
        }
        if(a.fwdDirection === true) {
            p0 = g[1];
            p1 = g[2];
        }else{
            p0 = g[g.length-2];
            p1 = g[g.length-3];
        }
        return [p0,p1];
    }
    //Return the points of the subsegment right after the middle node
    function getS2Points(s2){
        let p0, p1;
        const g = s2.attributes.geometry.getVertices();
        if(s2.attributes.fwdDirection === true) {
            p0 = g[0];
            p1 = g[1];
        }else{
            p0 = g[g.length-1];
            p1 = g[g.length-2];
        }
        return [p0, p1];
    }

    //Return the points of the subsegment right before the middle node
    function getS1Points(s1){
        let p0, p1;
        const g = s1.attributes.geometry.getVertices();
        if(s1.attributes.fwdDirection === true) {
            p0 = g[g.length-2];
            p1 = g[g.length-1];
        }else{
            p0 = g[1];
            p1 = g[0];
        }
        return [p0, p1];
    }

    // Check that the subsegment of s1 right before the node is at least 12m long
    function checkLengthOfIncomingSegment(dog){
        let [p0, p1] = getS1Points(dog.s1);
        let distance = computeDistance(p0, p1);
        console.debug("Length S1: " + distance);
        if(distance > INCOMING_MIN_LENGTH)
        {return true;}
        dog.s1_length = distance;
        return false;
    }

    //Check that the subsegment after the first geometric node is at least 12m long
    function lengthOfRampIsCorrect(dog){
        let p0, p1;
        try{
            [p0, p1] = getRampPoints(dog.offramp);
        }catch(e) {
            console.warn(e);
            return false;
        }
        let distance = computeDistance(p0, p1);
        console.debug("Length offramp: " + distance);
        if(distance > OFFRAMP_MIN_LENGTH)
        { return true;}
        dog.offramp_length = distance;
        return false;
    }

    // Check that the angle between S1 and S2 is max 10°
    function checkAngle1(dog) {
        let angle = Math.abs(ja_angle_diff(dog.node.getAngleToSegment(dog.s1), dog.node.getAngleToSegment(dog.s2)));
        console.debug("Angle 1: " + angle);
        if(angle > ANGLE1_MIN && angle < ANGLE1_MAX)
        {return true;}
        dog.angle1 = angle;
        return false;
    }

    // Check that the angle btw S2 and offramp is between 20-55°
    function checkAngle2(dog){
        let angle = Math.abs(ja_angle_diff(dog.node.getAngleToSegment(dog.s2), dog.node.getAngleToSegment(dog.offramp)));
        console.debug("Angle 2: "+angle);
        if(angle > ANGLE2_MIN && angle < ANGLE2_MAX)
        {return true;}
        dog.angle2 = angle;
        return false;
    }

    // Check that the delta is maximum 10°
    function checkDelta(dog){
        let r0, r1;
        try{
            [r0, r1] = getRampPoints(dog.offramp);
        }catch(e) {
            console.warn(e);
            return false;
        }
        let angleRamp = Math.atan2( r1.y - r0.y, r1.x - r0.x ) * One80DividedByPi; // 180.0 / Math.PI
        console.debug("angleRamp: " + angleRamp);

        let [hw0, hw1] = getS2Points(dog.s2);
        let angleHw = Math.atan2( hw1.y - hw0.y, hw1.x - hw0.x ) * One80DividedByPi;
        console.debug("angleHw: " + angleHw);

        let delta = Math.abs(ja_angle_diff(angleHw, angleRamp));
        console.debug("Delta: " + delta);
        if(delta < DELTA_MAX){
            return true;
        }
        dog.delta = delta;
        return false;
    }

    init();

})();
