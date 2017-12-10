/**
 * @author Omar Shehata / https://github.com/OmarShehata
 * Based off ConvexGeometry by Mugen87 / https://github.com/Mugen87
 */

( function() {

	// ConvexHyperGeometry

	function ConvexHyperGeometry( points ) {

		THREE.Geometry.call( this );

		this.type = 'ConvexHyperGeometry';

		this.fromBufferGeometry( new ConvexBufferGeometry( points ) );
		this.mergeVertices();

	}

	ConvexHyperGeometry.prototype = Object.create( THREE.Geometry.prototype );
	ConvexHyperGeometry.prototype.constructor = ConvexHyperGeometry;

	// ConvexBufferGeometry

	function ConvexBufferHyperGeometry( points ) {

	  THREE.BufferGeometry.call( this );

	  this.type = 'ConvexBufferHyperGeometry';

	  // buffers

	  var vertices = [];
	  var normals = [];

	  // execute QuickHull

		if ( THREE.QuickHull === undefined ) {

			console.error( 'THREE.ConvexBufferHyperGeometry: ConvexBufferHyperGeometry relies on THREE.QuickHull' );

		}

	  var points3D = [];
	  for(var i=0;i<points.length;i++){
	  	var p = new THREE.Vector3(points[i].x,points[i].y,points[i].z);
	  	p._w = points[i].w;
	  	points3D.push(p);
	  }

	  var quickHull = new THREE.QuickHull().setFromPoints( points3D );

	  // generate vertices and normals

	  var faces = quickHull.faces;

	  for ( var i = 0; i < faces.length; i ++ ) {

	    var face = faces[ i ];
	    var edge = face.edge;

	    // we move along a doubly-connected edge list to access all face points (see HalfEdge docs)

	    do {

	      var point = edge.head().point;

	      vertices.push( point.x, point.y, point.z, point._w );
	      normals.push( face.normal.x, face.normal.y, face.normal.z );

	      edge = edge.next;

	    } while ( edge !== face.edge );

	  }

	  // build geometry

	  this.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 4 ) );
	  this.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );

	}

	ConvexBufferHyperGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
	ConvexBufferHyperGeometry.prototype.constructor = ConvexBufferHyperGeometry;

	// export

	THREE.ConvexHyperGeometry = ConvexHyperGeometry;
	THREE.ConvexBufferHyperGeometry = ConvexBufferHyperGeometry;

	// HyperMaterial
	function HyperMaterial( parameters ) {
		function check( v, d ) {
			if( v === undefined ) return d;
			return v;
		}
		this.color = check( parameters.color, new THREE.Color( 0xff0000 ) );

		// Contains the vertex shader for 4D projection and translation 
		var vertexShader = `
			precision mediump float;
			precision mediump int;

			uniform mat4 modelViewMatrix; 
			uniform mat4 projectionMatrix; 

			attribute vec4 position; // It's a 4D world position!

			uniform float axis;
			uniform float axisValue;

			void main() {
				// Reinterpet coordinates based on the axis value 
				// axis = 0 -> (w,y,z, x)
				// axis = 1 -> (x,w,z, y)
				// axis = 2 -> (x,y,w, z)
				// axis = 3 -> (x,y,z, w)

				vec4 newPos;

				if(axis == 0.0) {
					newPos.xyzw = position.wyzx; 
					newPos.x  += axisValue;
				}
				if(axis == 1.0) {
					newPos.xyzw = position.xwzy; 
					newPos.y  += axisValue;
				}
				if(axis == 2.0) {
					newPos.xyzw = position.xywz; 
					newPos.z  += axisValue;
				}
				if(axis == 3.0) {
					newPos.xyzw = position.xyzw; 
					newPos.w  += axisValue;
				}

				// TODO: Apply camera rotations 
				
				float Lw = 1.0 / (11.0 - newPos.w);
				mat3 projection4DMatrix;
				projection4DMatrix[0] = vec3(Lw,0.,0.);
				projection4DMatrix[1] = vec3(0.,Lw,0.);
				projection4DMatrix[2] = vec3(0.,0.,Lw);


				newPos.xyz = projection4DMatrix * newPos.xyz;

				gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos.xyz,1.0);
			}
		`;

		var fragmentShader =`
			precision mediump float;
			precision mediump int;

			void main(){
				vec4 color = vec4(${this.color.r},${this.color.g},${this.color.b},0.5);
				
				gl_FragColor = color;
			}
		`;

		var uniforms = {
			axisValue: { type: "f", value: 0 },
			axis: { type: "f", value: 0 }
		};

		var material = new THREE.RawShaderMaterial({
			fragmentShader: fragmentShader,
			vertexShader: vertexShader,
			uniforms: uniforms,
			transparent:true
		});

		material.type = 'HyperMaterial';
		material.uniforms = uniforms;

		return material;

	}

	HyperMaterial.prototype = Object.create( THREE.Material.prototype );
	HyperMaterial.prototype.constructor = HyperMaterial;

	// export

	THREE.HyperMaterial = HyperMaterial;
	

} ) ();
