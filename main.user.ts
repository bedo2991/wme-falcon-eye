import { WmeSDK } from "wme-sdk-typings";
import * as turf from "@turf/turf";
import { Position } from "geojson";

interface Dogleg {
    isDoglegCandidate: boolean,
    s1?: Waze.Feature.Vector.Segment,
    s2?: Waze.Feature.Vector.Segment,
    offramp?: Waze.Feature.Vector.Segment,
    node?: Waze.Feature.Vector.Node,
    angle1?: number,
    angle2?: number,
    delta?: number,
    offramp_length?: number,
    s1_length?: number,
}

enum FalconLayer {
    Segments = "Falcon Eye",
    Labels = "Falcon Eye Labels"
}

// the sdk initScript function will be called after the SDK is initialized
window.SDK_INITIALIZED.then(initScript);

function initScript() {
    // initialize the sdk, these should remain here at the top of the script
    if (!window.getWmeSdk) {
        // This block is required for type checking, but it is guaranteed that the function exists.
        throw new Error("SDK not available");
    }
    const wmeSDK: WmeSDK = window.getWmeSdk(
        {
            scriptId: "wme-falcon-eye",
            scriptName: "WME Falcon Eye"
        }
    )

    console.debug(`SDK v. ${wmeSDK.getSDKVersion()} on ${wmeSDK.getWMEVersion()} initialized`)

    enum AlertType {
        INFO = 'info',
        ERROR = 'error',
        SUCCESS = 'success',
        WARNING = 'warning',
        DEBUG = 'debug',
    };
    const safeAlert = (level: AlertType, message: string) => {
        try {
            WazeWrap.Alerts[level](GM_info.script.name, message);
        } catch (e) {
            console.error(e);
            alert(message);
        }
    };

    function addLayers() {
        wmeSDK.Map.addLayer({
            layerName: FalconLayer.Segments,
            styleRules: [
                {
                    style: { // Default style, success
                        pointerEvents: 'none',
                        strokeColor: '#00ff00',
                        strokeWidth: 25,
                        strokeOpacity: 0.5,
                        strokeDashstyle: 'solid',
                        strokeLinecap: 'butt',
                    },
                },
                {
                    predicate: featureProperties => !!featureProperties.isError,
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
                    predicate: featureProperties => !!featureProperties.isWarning,
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
                        'labelAlign': 'cm', // set to center middle
                        'visibility': true,
                    }
                }]
        });

        //wmeSDK.LayerSwitcher.addLayerCheckbox({
        //    name: "Falcon Eye",
        //})

        // Draw a feature
        // wmeSDK.Map.addFeatureToLayer(
        //     {
        //         layerName: "Falcon Eye",
        //         feature: {
        //             id: "falcon-eye",
        //             geometry: {
        //                 coordinates: [wmeSDK.Map.getMapCenter().lon, wmeSDK.Map.getMapCenter().lat],
        //                 type: "Point"
        //             },
        //             type: "Feature",
        //         }
        //     }
        // )
    }

    const SCRIPT_VERSION = GM_info.script.version;
    const SCRIPT_NAME = GM_info.script.name;

    enum States {
        enabled = "E",
        disabled = "D",
        zoom_disabled = "ZD",
    };

    const scriptEnabledDefault = true;
    const energy_saving_enabledDefault = true;
    const checkFromZoomDefault = 17;

    const settings = Object.seal({
        script_enabled: scriptEnabledDefault,
        energy_saving: energy_saving_enabledDefault,
        check_from_zoom: checkFromZoomDefault
    });

    const One80DividedByPi = 180.0 / Math.PI;

    let OLWazeProjection: OpenLayers.Projection;
    let WorldGeodeticSystemProjection: OpenLayers.Projection;


    const ANGLE1_MIN = 170.0;
    const ANGLE1_MAX = 190.0;

    const ANGLE2_MIN = 20.0;
    const ANGLE2_MAX = 55.0;

    const OFFRAMP_MIN_LENGTH = 12.0;

    const INCOMING_MIN_LENGTH = 12.0;

    const DELTA_MAX = 10.0;

    //let doglegLayer: OpenLayers.Layer.Vector;
    //let doglegLabelsLayer: OpenLayers.Layer.Vector;

    async function init() {
        addLayers();
        await setUpLeftPanel();
        waitForWazeWrap().then((result) => {
            if (result === true) {
                initWazeWrapElements();
            }
        });
        initOpenLayersElements();
        manageStateChange();
        initEvents();
        startCheck();
    }

    function initOpenLayersElements() {
        OLWazeProjection = W.map.getOLMap().projection;
        WorldGeodeticSystemProjection = new OpenLayers.Projection('EPSG:4326');
    }

    function createInput({ id, type, className, title, min, max, step }: { id: string; type: string; className?: (string | undefined); title: (string | undefined); min?: number; max?: number; step?: number; }) {
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
            input.min = min?.toString() || "";
            input.max = max?.toString() || "";
            input.step = step?.toString() || "";
        }
        return input;
    }

    function createCheckboxOption({ id, title, description }: { id: string; title: string; description: string; isNew?: (string | undefined); }) {
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


    function createDropdownOption({ id, title, description, options, isNew }: { id: string, title: string, description: string, options: ({ text: string; value: string }[] | string[]), isNew?: string }) {
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

    function setScriptStatus(state: States) {
        const div = <HTMLDivElement>document.getElementById("dog_script_state");
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

        // Checkbox Enable or disable the check

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

        const { tabLabel, tabPane } = await wmeSDK.Sidebar.registerScriptTab()
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
        (<HTMLInputElement>document.getElementById("dog_enable")).checked = settings.script_enabled;
        (<HTMLInputElement>document.getElementById("dog_energy")).checked = settings.energy_saving;
        (<HTMLInputElement>document.getElementById("dog_zoom")).value = String(settings.check_from_zoom);
    }

    function addSettingsEventListeners() {
        (<HTMLInputElement>document.getElementById("dog_enable")).addEventListener("click", toggleEnableCheckbox);
        (<HTMLInputElement>document.getElementById("dog_energy")).addEventListener("click", toggleEnergySavingCheckbox);
        (<HTMLInputElement>document.getElementById("dog_zoom")).addEventListener("change", zoomSettingChanged);
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
        } catch (ex) {
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

    function zoomSettingChanged(e: Event) {
        settings.check_from_zoom = parseInt(e.target.value);
        storeSettings();
    }

    function toggleEnableCheckbox(e: Event) {
        settings.script_enabled = e.target.checked;
        storeSettings();
        manageStateChange();
    }

    function manageStateChange() {
        if (settings.script_enabled) {
            removeEvents();
            initEvents();
            setScriptStatus(States.enabled);
        } else {
            // Script was disabled
            removeEvents();
            clearAll();
            setScriptStatus(States.disabled);
        }
    }

    function toggleEnergySavingCheckbox(e) {
        settings.energy_saving = e.target.checked;
        safeAlert(AlertType.INFO, settings.energy_saving ? "The script will stop looking for problems after finding one" : "The script will show all doglegs problems at once");
        storeSettings();
    }

    function initWazeWrapElements() {
        WazeWrap.Interface.ShowScriptUpdate(
            SCRIPT_NAME,
            SCRIPT_VERSION,
            `<b>What's new?</b>
            <ul>
            <li>1.1.1: Use the new WME SDK.</li>
            <li>1.0.0: Use the new WME API, store the settings when they get changed.</li>
            <li>0.0.9.5: The checkbox to disable the script now really disables the script. It is possible to select from what zoom level the script should work. The script state gets displayed in the script's panel.</li>
            <li>0.0.9.3: Fixes a problem with zoom while a segment is selected</li>
            <li>0.0.9.2: Fixes a problem when a ramp does not have enough geonodes</li>
            <li>0.0.7: Use realsize distance (take Earth curvature into consideration)</li>
            </ul>`,
            "",
            GM_info.script.supportURL
        );
    }

    async function waitForWazeWrap() {
        let trials = 1;
        let sleepTime = 400;
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

    function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    let dataLoadedEvent: () => void = () => { };
    let segmentChanged: () => void = () => { };
    function removeEvents() {
        dataLoadedEvent();
        segmentChanged();
        wmeSDK.Events.stopDataModelEventsTracking({ dataModelName: "segments" });
        dataLoadedEvent = () => { };
        segmentChanged = () => { };
    }

    function initEvents() {
        console.debug("Events initialization");
        dataLoadedEvent = wmeSDK.Events.on(
            {
                eventHandler: startCheck,
                eventName: "wme-map-data-loaded"
            }
        )

        segmentChanged = wmeSDK.Events.on(
            {
                eventHandler: startCheck,
                eventName: "wme-data-model-objects-changed"
            }
        )
        wmeSDK.Events.trackDataModelEvents({ dataModelName: "segments" });
    }


    /**
     * Remove all features for all layers
     */
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
            checkSegments(Object.values(W.model.segments.objects));
        } else {
            setScriptStatus(States.zoom_disabled);
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
    function ja_angle_diff(aIn: number, aOut: number, absolute = true): number {
        let a = aOut - aIn;
        if (a > 180.0) { a -= 360.0; }
        if (a < -180.0) { a += 360.0; }
        return absolute ? a : (a > 0.0 ? a - 180.0 : a + 180.0);
    }
    // This function checks if a given segment is a dogleg candidate
    // We consider a dogleg candidate a one-way highway segment (freeway, major or minor)
    // Leading to a node with one off-ramp segment and another highway segment of the same type
    // Consider if the name equality of the highway should also be checked)
    function detectDoglegCandidate(segmentModel: Waze.Feature.Vector.Segment) {
        console.debug("Checking the given segment: " + segmentModel.attributes.id);
        const nodogleg: Dogleg = { isDoglegCandidate: false };
        let s2 = null;
        let offramp = null;

        // Check if s1 is one-way
        if (!segmentModel.isOneWay()) {
            return nodogleg;
        }

        const attr1 = segmentModel.attributes;

        // Check if s1 is a highway
        let roadType1 = attr1.roadType;

        if (![3, 6, 7].includes(roadType1)) {
            return nodogleg;
        }

        // Check that s1 is not a roundabout
        if (attr1.junctionID !== null) {
            return nodogleg;
        }

        // get the "to" node of thisSegment
        let middleNodeModel = null;
        if (attr1.fwdDirection) {
            middleNodeModel = W.model.nodes.getObjectById(attr1.toNodeID)
        }
        else {
            middleNodeModel = W.model.nodes.getObjectById(attr1.fromNodeID)
        }

        if (!middleNodeModel) {
            // This happens when drawing a new segment
            return nodogleg;
        }

        // Check if there are exactly 2 other segments connected to the "to" node
        const connectedSegmentsIDs = middleNodeModel.getSegmentIds();
        if (connectedSegmentsIDs.length !== 3) {
            return nodogleg;
        }

        // Check that it is possible to go from the first segment to both other 2 segments
        console.debug("Checking connections");
        for (let i = 0; i < connectedSegmentsIDs.length; i++) {
            if (connectedSegmentsIDs[i] === attr1.id) {
                continue;
            }
            let otherSegment = W.model.segments.getObjectById(connectedSegmentsIDs[i]);
            if (!otherSegment)
                continue;

            if (!middleNodeModel.isTurnAllowedBySegDirections(segmentModel, otherSegment)) {
                console.debug("Connection is not allowed, skipping...");
                return nodogleg;
            }
            console.debug("Setting the other 2 segments");
            if (otherSegment.attributes.roadType === 4) {
                console.debug("Segment is a ramp");
                if (offramp) {
                    return nodogleg;
                }
                // The ramp must be one-way
                if (!otherSegment.isOneWay()) {
                    return nodogleg;
                }
                offramp = otherSegment;
            }
            else if (otherSegment.attributes.roadType === attr1.roadType) {
                console.debug("Segment is S2");
                if (s2) {
                    return nodogleg;
                }
                // S2 must be one-way
                if (!otherSegment.isOneWay()) {
                    return nodogleg;
                }
                s2 = otherSegment;
            } else {
                console.debug("Segment is invalid");
                return nodogleg;
            }
        }

        if (!s2 || !offramp) {
            console.info("Dogleg almost detected...");
            return nodogleg;
        }

        console.debug("Segment is S1 of a dogleg");
        return {
            isDoglegCandidate: true,
            s1: segmentModel,
            s2: s2,
            offramp: offramp,
            node: middleNodeModel
        };
    }

    function checkSegments(s: Array<Waze.Feature.Vector.Segment> = []) {
        console.debug("Checking the given segments");
        for (let i = 0; i < s.length; i++) {
            let res = detectDoglegCandidate(s[i]);
            if (res.isDoglegCandidate === true) {
                console.dir(res);
                if (isDoglegValid(res, settings.energy_saving)) {
                    highlightDoglegSuccess(res);
                } else {
                    highlightDoglegFail(res);
                }
            }
        }
    }

    function addLabel(feature: SDKFeature) {
        wmeSDK.Map.addFeatureToLayer({
            feature: feature, layerName: "Falcon Eye Labels"
        })
        //doglegLabelsLayer.addFeatures(Array.of(feature), { 'silent': true });
    }

    function createLabel(text: string, point: OpenLayers.Geometry.Point, xOffset = 0, yOffset = 0) {
        let convertedGeometry = W.userscripts.toGeoJSONGeometry(point).coordinates;
        return {
            geometry:
            {
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
        }
    }

    function createLineFeature({ olGeometry, properties }: { olGeometry: OpenLayers.Geometry.LineString, properties: { [key: string]: any } }): SdkFeature<WazeFeatureGeometry> {
        let convertedGeometry = W.userscripts.toGeoJSONGeometry(olGeometry);
        return {
            geometry:
            {
                coordinates: convertedGeometry.coordinates,
                type: "LineString"
            },
            id: Date.now().toString(),
            properties: properties,
            type: "Feature"
        }
    }


    function highlightDogleg(dogleg: Dogleg, failure: boolean) {
        console.debug("Highlight");
        //let style = failure ? warningStyle : successStyle;

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
            lineFeature = createLineFeature({
                olGeometry: new OpenLayers.Geometry.LineString(reducedPointList),
                properties: { isError: true }
            });
            let labelFeature = createLabel(`${dogleg.s1_length.toLocaleString(undefined,
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}m`, reducedPointList[0], 30, 30);
            addLabel(labelFeature);
        } else {
            lineFeature = createLineFeature({
                olGeometry: new OpenLayers.Geometry.LineString(reducedPointList),
                properties: { isWarning: !!failure }
            });
        }


        let reducedPointListRamp;
        try {
            reducedPointListRamp = getRampPoints(dogleg.offramp);
        }
        catch (e) {
            //The ramp does not have enough geo nodes.
            return;
        }
        let lineFeatureRamp = null;
        if (dogleg.delta) {
            let labelFeature = createLabel(`Δ: ${dogleg.delta.toFixed(2)}°`, reducedPointListRamp[0], 30, 30);
            addLabel(labelFeature);
        }
        if (dogleg.offramp_length) {
            lineFeatureRamp = createLineFeature({
                olGeometry: new OpenLayers.Geometry.LineString(reducedPointListRamp),
                properties: { isError: true }
            });
            let labelFeature = createLabel(`${dogleg.offramp_length.toLocaleString(undefined,
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}m`, reducedPointListRamp[0], -30, -30);
            addLabel(labelFeature);
        } else {
            lineFeatureRamp = createLineFeature({
                olGeometry: new OpenLayers.Geometry.LineString(reducedPointListRamp),
                properties: { isWarning: !!failure }
            });
        }
        wmeSDK.Map.addFeaturesToLayer({
            features: [lineFeature, lineFeatureRamp],
            layerName: FalconLayer.Segments
        });
    }

    function highlightDoglegSuccess(dogleg: Dogleg) {
        console.debug("Highlight success");
        highlightDogleg(dogleg, false);
    }

    function highlightDoglegFail(dogleg: Dogleg) {
        console.debug("Highlight false");
        highlightDogleg(dogleg, true);
    }

    /***
    Checks if the given dogleg is correct and will be used nicely by Falcon
    */
    function isDoglegValid(dog: Dogleg, shortcut = false): boolean {
        if (shortcut) {
            return checkLengthOfIncomingSegment(dog) && checkLengthOfRampIsCorrect(dog) && checkAngle1(dog) && checkAngle2(dog) && checkDelta(dog);
        }

        let result = checkLengthOfIncomingSegment(dog);
        //N.B. using &&= is not the same!
        result = checkLengthOfRampIsCorrect(dog) && result;
        result = checkAngle1(dog) && result;
        result = checkAngle2(dog) && result;
        result = checkDelta(dog) && result;
        return result;
    }

    // Returns the distance in meter between the points p0 and p1
    /** @deprecated */
    function computeDistance(p0, p1) {
        return turf.distance(W.userscripts.toGeoJSONGeometry(p0), W.userscripts.toGeoJSONGeometry(p1), { units: 'meters' });
    }

    function computeDistanceInMeters(p0: turf.helpers.Coord, p1: turf.helpers.Coord) {
        return turf.distance(p0, p1, { units: 'meters' });
    }

    //Returns [p0, p1] of the second subsegment starting from the middleNode
    /** @deprecated */
    function getRampPoints(ramp: Waze.Feature.Vector.Segment) {
        let p0, p1;
        const a = ramp.attributes;
        const g = a.geometry.getVertices();
        // What do you do if the offramp does not have a second subsegment?
        if (g.length < 3) {
            throw 'Ramp does not have enough subsegments.';
        }
        if (a.fwdDirection === true) {
            p0 = g[1];
            p1 = g[2];
        } else {
            p0 = g[g.length - 2];
            p1 = g[g.length - 3];
        }
        return [p0, p1];
    }

    function getRampGeoPoints(rampId: number): Position[] {
        let p0, p1;
        const ramp = wmeSDK.DataModel.Segments.getById({
            segmentId: rampId
        });
        const g = ramp?.geometry.coordinates;
        if (!g) throw "Geometry not found";
        // What do you do if the offramp does not have a second subsegment?
        if (g.length < 3) {
            throw 'Ramp does not have enough subsegments.';
        }
        if (ramp.isAtoB) {
            p0 = g[1];
            p1 = g[2];
        } else {
            p0 = g[g.length - 2];
            p1 = g[g.length - 3];
        }
        return [p0, p1];
    }
    //Return the points of the subsegment right after the middle node
    /** @deprecated */
    function getS2Points(s2) {
        let p0, p1;
        const g = s2.attributes.geometry.getVertices();
        if (s2.attributes.fwdDirection === true) {
            p0 = g[0];
            p1 = g[1];
        } else {
            p0 = g[g.length - 1];
            p1 = g[g.length - 2];
        }
        return [p0, p1];
    }

    /**
     * Return the points of the subsegment right after the middle node
     * @param s2 
     * @returns 
     */
    function getS2GeoPoints(s2Id: number): Position[] {
        let p0, p1;
        const s2 = wmeSDK.DataModel.Segments.getById({
            segmentId: s2Id
        });
        const g = s2?.geometry.coordinates;
        if (!g) throw "Geometry not found";
        if (s2?.isAtoB) {
            p0 = g[0];
            p1 = g[1];
        } else {
            p0 = g[g.length - 1];
            p1 = g[g.length - 2];
        }
        return [p0, p1];
    }

    //Return the points of the subsegment right before the middle node
    /** @deprecated */
    function getS1Points(s1: Waze.Feature.Vector.Segment) {
        let p0, p1;
        const g = s1.attributes.geometry.getVertices();
        if (s1.attributes.fwdDirection === true) {
            p0 = g[g.length - 2];
            p1 = g[g.length - 1];
        } else {
            p0 = g[1];
            p1 = g[0];
        }
        return [p0, p1];
    }

    function getS1GeoPoints(segmentId: number): Array<Position> {
        let p0, p1;
        const s1 = wmeSDK.DataModel.Segments.getById({
            segmentId: segmentId
        });
        const g = s1?.geometry.coordinates;
        if (!g) throw "Geometry not found";
        if (s1?.isAtoB) {
            p0 = g[g.length - 2];
            p1 = g[g.length - 1];
        } else {
            p0 = g[1];
            p1 = g[0];
        }
        return [p0, p1];
    }

    // Check that the subsegment of s1 right before the node is at least 12m long
    function checkLengthOfIncomingSegment(dog: Dogleg) {
        const s1ID = dog.s1?.attributes.id;
        if (!s1ID) throw "Could not find the offramp id";
        let [p0, p1] = getS1GeoPoints(s1ID);
        let distance = computeDistanceInMeters(p0, p1);
        console.debug("Length S1: " + distance);
        if (distance > INCOMING_MIN_LENGTH) { return true; }
        dog.s1_length = distance;
        return false;
    }

    //Check that the subsegment after the first geometric node is at least 12m long
    function checkLengthOfRampIsCorrect(dog: Dogleg): boolean {
        let p0: Position, p1: Position;
        const offRampId = dog.offramp?.attributes.id;
        if (!offRampId) throw "Could not find the offramp id";
        try {
            [p0, p1] = getRampGeoPoints(offRampId);
        } catch (e) {
            console.warn(e);
            return false;
        }
        let distance = computeDistanceInMeters(p0, p1);
        console.debug("Offramp length: " + distance);
        if (distance > OFFRAMP_MIN_LENGTH) { return true; }
        dog.offramp_length = distance;
        return false;
    }

    // Check that the angle between S1 and S2 is max 10°
    function checkAngle1(dog: Dogleg) {
        let angle = Math.abs(ja_angle_diff(dog.node.getAngleToSegment(dog.s1), dog.node.getAngleToSegment(dog.s2)));
        console.debug("Angle 1: " + angle);
        if (angle > ANGLE1_MIN && angle < ANGLE1_MAX) { return true; }
        dog.angle1 = angle;
        return false;
    }

    // Check that the angle btw S2 and offramp is between 20-55°
    function checkAngle2(dog: Dogleg) {
        let angle = Math.abs(ja_angle_diff(dog.node.getAngleToSegment(dog.s2), dog.node.getAngleToSegment(dog.offramp)));
        console.debug("Angle 2: " + angle);
        if (angle > ANGLE2_MIN && angle < ANGLE2_MAX) { return true; }
        dog.angle2 = angle;
        return false;
    }

    // Check that the delta is maximum 10°
    function checkDelta(dog: Dogleg) {
        let r0, r1;
        if (!dog.offramp?.attributes.id || !dog.s2?.attributes.id) {
            throw "Could not find the offramp or s2 id";
        }
        try {
            [r0, r1] = getRampGeoPoints(dog.offramp?.attributes.id);
        } catch (e) {
            console.warn(e);
            return false;
        }
        let angleRamp = Math.atan2(r1[1] - r0[1], r1[0] - r0[0]) * One80DividedByPi; // 180.0 / Math.PI
        console.debug("angleRamp: " + angleRamp);

        let [hw0, hw1] = getS2GeoPoints(dog.s2?.attributes.id);
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
