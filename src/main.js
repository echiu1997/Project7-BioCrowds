
// Skybox texture from: https://github.com/mrdoob/three.js/tree/master/examples/textures/cube/skybox

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much
import Framework from './framework'

var startTime = Date.now();

///////////////////////////SLIDERS///////////////////////////////

var Sliders = function() {
    this.numAgents = 10;
    this.perception = 10;
};
var sliders = new Sliders();

///////////////////////DATA STRUCTURES///////////////////////////

var gridCellWidth = sliders.perception * 2.0;
var resolution = 5.0; 
var gridWidth = gridCellWidth * resolution;
var markersPerCell = gridCellWidth / 2.0;

var allAgents = new Set();
var allMarkers = new Set();
var cellToMarkers = new Array();

///////////////////////////CLASSES///////////////////////////////

class Marker {
    constructor(x, z) {
        this.pos = new THREE.Vector2(x, z);
        this.agent = null;
    }
};

class Agent {
    constructor(p, v, g) {
        this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4), new THREE.MeshLambertMaterial());
        this.mesh.position.set(p.x, 4/2, p.z);
        this.vel = v;
        this.goal = g;
        this.markers = new Set();
    }
};

/////////////////////////////////////////////////////////////////

// called after the scene loads
function onLoad(framework) {
    var scene = framework.scene;
    var camera = framework.camera;
    var renderer = framework.renderer;
    var gui = framework.gui;
    var stats = framework.stats;

    // Set light
    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionalLight.color.setHSL(0.1, 1, 0.95);
    directionalLight.position.set(1, 3, 2);
    directionalLight.position.multiplyScalar(10);
    scene.add(directionalLight);  

    // set skybox
    var loader = new THREE.CubeTextureLoader();
    var urlPrefix = '/images/skymap/';
    var skymap = new THREE.CubeTextureLoader().load([
        urlPrefix + 'px.jpg', urlPrefix + 'nx.jpg',
        urlPrefix + 'py.jpg', urlPrefix + 'ny.jpg',
        urlPrefix + 'pz.jpg', urlPrefix + 'nz.jpg'
    ] );
    scene.background = skymap;

    // set camera position
    camera.position.set(0, 5, 0);
    camera.lookAt(new THREE.Vector3(0,0,0));

    /*
    //initialize the ground
    var planeGeometry = new THREE.PlaneGeometry(gridWidth, gridWidth);
    var planeMaterial = new THREE.MeshLambertMaterial({color: 0x8BA870, side: THREE.DoubleSide, shading: THREE.FlatShading });
    var plane = new THREE.Mesh(planeGeometry, planeMaterial);
    //apply rotation
    plane.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1.0, 0.0, 0.0), -Math.PI/2.0)
    ));
    scene.add(plane);
    */
    
    //generate agents
    for (var i = 0; i < sliders.numAgents; i++) {
        var a = new Agent(new THREE.Vector3(Math.random()*gridWidth, 0, Math.random()*gridWidth));
        allAgents.add(a);
        scene.add(a.mesh);
    }

    //debugging purposes
    var pMaterial = new THREE.PointsMaterial( { color: 0xffffff } );
    var points = new THREE.Points(new THREE.Geometry(), pMaterial);
    scene.add(points);

    //generate markers
    for (var cellx = 0; cellx < resolution; cellx++) {
        cellToMarkers[cellx] = new Array();
        for (var cellz = 0; cellz < resolution; cellz++) {
            cellToMarkers[cellx][cellz] = new Set();

            //stratified sampling in one grid cell
            for (var i = 0; i < markersPerCell; i++) {
                for (var j = 0; j < markersPerCell; j++) {
                    
                    var x = gridCellWidth*cellx + gridCellWidth/markersPerCell*i + Math.random()*gridCellWidth/markersPerCell;
                    var z = gridCellWidth*cellz + gridCellWidth/markersPerCell*j + Math.random()*gridCellWidth/markersPerCell;
                    var newMarker = new Marker(x, z);
                    cellToMarkers[cellx][cellz].add(newMarker);
                    allMarkers.add(newMarker)

                    //debugging purposes
                    points.geometry.vertices.push(new THREE.Vector3(x, 0, z));
                }
            }

        }
    }

    //for each agent, find 4 closest cells
    for (var a of allAgents.values()) {

        var p = new THREE.Vector2(a.mesh.position.x, a.mesh.position.z).divideScalar(gridCellWidth);
        var currCell = new THREE.Vector2(p.x, p.y).floor();
        var offset = new THREE.Vector2(p.x, p.y).sub(currCell).round();
        //find the shared corner of 4 closest cells
        var sharedCorner = new THREE.Vector2(currCell.x, currCell.y).add(offset);

        //iterate through 4 closest cells
        for (var cellx = -1; cellx < 1; cellx++) {
            for (var cellz = -1; cellz < 1; cellz++) {

                var cellIndex = new THREE.Vector2(sharedCorner.x, sharedCorner.y).add(new THREE.Vector2(cellx, cellz));
                //make sure cell index is not out of bounds
                if (cellIndex.x >= 0 && cellIndex.y >= 0 && cellIndex.x < resolution && cellIndex.y < resolution) {
                    var markerSet = cellToMarkers[cellIndex.x][cellIndex.y];
                    //iterate through markers in cell
                    for (var marker of markerSet.values()) {
                        var markerPos = new THREE.Vector3(marker.pos.x, 0, marker.pos.y);
                        //check if marker within perception field of agent
                        //and if marker.agent is null OR new agent is closer to marker than old agent
                        //set marker.agent to new agent
                        if (markerPos.distanceTo(a.mesh.position) <= sliders.perception &&
                            ( marker.agent == null || markerPos.distanceTo(a.mesh.position) < markerPos.distanceTo(marker.agent.mesh.position) )) {
                            marker.agent = a;
                        }
                    }
                }

            }
        }

    }

    //add all markers with an assigned agent to the respective agent
    //O(m) time, compared to removing markers set of replaced agent above, which is O(m log(m))
    for (var m of allMarkers.values()) {
        if (m.agent != null) {
            m.agent.markers.add(m);
        }
    }
    
    //debugging purposes
    var lineMaterial = new THREE.LineBasicMaterial({color: 0xffffff, linewidth: 10});
    var lineGeom = new THREE.Geometry();
    for (var a of allAgents.values()) {
        for (var m of a.markers.values()) {
            lineGeom.vertices.push(new THREE.Vector3(a.mesh.position.x, a.mesh.position.y, a.mesh.position.z));
            lineGeom.vertices.push(new THREE.Vector3(m.pos.x, 0, m.pos.y));
        }
    }
    var line = new THREE.LineSegments( lineGeom, lineMaterial );
    scene.add(line);
    


    // edit params and listen to changes like this
    // more information here: https://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage
    gui.add(camera, 'fov', 0, 180).onFinishChange(function(newVal) {
        camera.updateProjectionMatrix();
    });

    //add perception slider for user to adjust
    //gui.add(sliders, 'perception', 0.0, 10.0).step(1.0);
}

// called on frame updates
function onUpdate(framework) {

    /*
    for (var i = framework.scene.children.length - 1; i >= 0; i--) {
        if (framework.scene.children[i].name == "feather") {
            var f = framework.scene.children[i];
            f.geometry.dispose();
            f.material.dispose();
            framework.scene.remove(f);
        }
    }
    */

    /*
    //bottom curve
    curve1 = new THREE.CubicBezierCurve3(
        new THREE.Vector3( 0, 0, -5 ),
        new THREE.Vector3( -2 - 2.0 * sliders.curvature, 0, 0 ),
        new THREE.Vector3( 2 + 2.0 * sliders.curvature, sliders.flapmotion/2.0 * sin(2, 0, (sliders.flapspeed * 0.003) * (Date.now()-startTime)) , 0 ),
        new THREE.Vector3( 0, sliders.flapmotion * sin(2, 0, (sliders.flapspeed * 0.003) * (Date.now()-startTime)) - 0.20*sliders.flapmotion, 5 )
    );

    //top curve
    curve2 = new THREE.CubicBezierCurve3(
        new THREE.Vector3( 0, 0.1, -5 ),
        new THREE.Vector3( -2 - 2.0 * sliders.curvature, 1, 0 ),
        new THREE.Vector3( 2 + 2.0 * sliders.curvature, sliders.flapmotion/2.0 * sin(2, 0, (sliders.flapspeed * 0.003) * (Date.now()-startTime)) + 0.2, 0 ),
        new THREE.Vector3( 0, sliders.flapmotion * sin(2, 0, (sliders.flapspeed * 0.003) * (Date.now()-startTime)), 5 )
    );

    for (var layer = 0.0; layer <= 1.0; layer += 0.5) {

        //interpolate feather scaling base for each layer, numbers chosen myself
        var scaleBase = 1.0 * (1.0 - layer) + 0.5 * layer;
        //interpolate feather scaling factor (max scaling), numbers chosen myself
        var scaleFactor = (2.0*sliders.size) * (1.0 - layer) + (0.5*sliders.size) * layer;
        //interpolate feather distribution, numbers chosen myself
        var featherDistribution = (0.05/sliders.distribution) * (1.0 - layer) + (0.025/sliders.distribution) * layer;
        //interpolate feather color darkness
        var darkness = 0.8 * (1.0 - layer) + 0.2 * layer;

        for (var i = 0.0; i <= 1.0; i += featherDistribution) {
            
            var featherMesh = new THREE.Mesh(featherGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
            featherMesh.name = "feather";

            featherMesh.material.color.setRGB(darkness*sliders.color, darkness*sliders.color, darkness*1.0);

            var y = curve1.getPointAt(i).y * (1.0 - layer) + curve2.getPointAt(i).y * layer;
            featherMesh.position.set(curve1.getPointAt(i).x, y, curve1.getPointAt(i).z);

            featherMesh.rotateY(180.0 * Math.PI/180.0);
            featherMesh.rotateY(gain(0.5, i)*sliders.orientation*Math.PI/180.0);

            var scalar = scaleBase + gain(0.5, i)*scaleFactor;
            featherMesh.scale.set(scalar, scalar, scalar);

            //animation for wind turbulence
            featherMesh.rotateZ((sliders.turbulence)*Math.PI/180.0 * sin(2, featherMesh.position.x, (sliders.turbulence * 0.003)*(Date.now()-startTime)));

            framework.scene.add(featherMesh);
        }
    }
    */   
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);