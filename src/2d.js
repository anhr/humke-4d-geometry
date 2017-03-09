// All logic & rendering of the 2D mode is contained here
// depends on Mathbox existing in the scope as well as the gui class

/* 
todo:

- Draw parametric 
- Make render shape work
- Make intersection work (with samples)
- Apply same to 3D 
- Create barebones 4D
- Apply hash when clicking on any of the modes 
*/

var Mode2D = (function (scope) {
	//Constructor 
	function Mode2D(document){
		this.document = document; 
		this.thicknessValuesTable = {'thin':0.2,'medium':0.5,'thick':1}

		// Cartesian properties
		this.edgeArray = [];
		this.current_mode = null;
		// Convex Hull points
		this.pointsArray = [];
	}

	// Creates the scene and everything
	Mode2D.prototype.init = function(div,gui){
		// Create two child divs 
		var leftChild = document.createElement("div");
		var rightChild = document.createElement("div");
		div.appendChild(leftChild); leftChild.id = "left-view";
		div.appendChild(rightChild); rightChild.id = "right-view";
		var style = "display:inline-block;"
		leftChild.style = style;
		rightChild.style = style;
		this.leftChild = leftChild; this.rightChild = rightChild;
		
		var viewWidth = (window.innerWidth-20)/2;
		var leftView = this.createView(leftChild,viewWidth);
		var rightView = this.createView(rightChild,viewWidth);
		this.leftView = leftView;
		this.rightView = rightView;

		// Init gui 
	    gui.init("2D",this.callbacks,this);
	    this.gui = gui;

		// Set up left view
		var camera = leftView.camera({
		  proxy: true, // this alows interactive camera controls to override the position
		  position: [0, 0, 3],
		})
		leftView = leftView.cartesian({
		  range: [[-10, 10], [-10, 10]],
		  scale: [1, 1],
		});
		leftView
		  .axis({
		    axis: 1,
		    width: 4,
		    color:'black',
		  })
		  .axis({
		    axis: 2,
		    width: 4,
		    color:'black',
		  })
		  .grid({
		    width: 1,
		    divideX: 10,
		    divideY: 10
		  });

		 // Add text
		leftView.array({
		  data: [[11,1], [0,12]],
		  channels: 2, // necessary
		  live: false,
		}).text({
		  data: ["x", "y"],
		}).label({
		  color: 0x000000,
		});

		this.leftView = leftView;
		this.CreateViewLine();

		// Draw our main shape
		this.setMode()

		// Set up right view
		rightView = rightView.cartesian({
		  range: [[-10, 10],[-10,10]],
		  scale: [1, 1],
		});

		rightView.camera({
		  proxy: true, // this alows interactive camera controls to override the position
		  position: [0, 0, 3],
		})
		this.rightView = rightView

	    this.CreateViewAxis(1,[11,1],"x")
	}

	Mode2D.prototype.CreateViewAxis = function(axisNum,pos,labelName){
		this.rightView.axis({
		    axis: axisNum,
		    width: 4,
		    color:'black',
		    id:'viewing_1d_axis',
		  })

		this.rightView.array({
	      data: [pos],
	      channels: 2, // necessary
	      live: false,
	    }).text({
	      data: [labelName],
	    }).label({
	      color: 0x000000,
	      id:'viewing_1d_axis_label',
	    });

	}

	Mode2D.prototype.CreateViewLine = function(){
		//The line on the left to show you what it's intersecting 
		var params = this.gui.params
		var thickness = this.thicknessValuesTable[params.thickness]
		this.leftView.interval({
			expr: function(emit,x,i,t){
				if(params.axis == "Y")
					emit(x,params.axis_value);
				else
					emit(params.axis_value,x);
			},
			width:2,
			channels:2,
			id:"viewing_axis"
		}).line({
			width:5 + 5 * thickness,
			color:this.gui.colors.viewing,
			id:"viewing_axis_line"
		})
	}

	// define a function to be called when each param is updated
	Mode2D.prototype.callbacks = {
		'axis': function(self,val){
			self.rightView.remove("#viewing_1d_axis")
	    	self.rightView.remove("#viewing_1d_axis_label")
			if(val == "Y") self.CreateViewAxis(1,[11,1],"x")
			if(val == "X") self.CreateViewAxis(2,[0,12],"y")
		},
		'thickness': function(self,val){
			// need to change the line's property when thickness changes
			self.leftView.select("#viewing_axis_line").set("width",5+5*self.thicknessValuesTable[self.gui.params.thickness])
		},
		'source': function(self,val){
			self.setMode();
		}, 
		'resolution': function(self,val){
			self.parseCartesian();
			self.polygonizeCartesian();
		},
		'equation': function(self,val){
			self.parseCartesian();
			self.polygonizeCartesian();
		},
		'points': function(self,val){
			self.updateConvexHull()
		}
	};

	Mode2D.prototype.setMode = function(){
		var params = this.gui.params
		console.log(params.source)
		//Switch the mode based on the gui value 
		if(this.current_mode != null){
			//Clean up previous 
			if(this.current_mode == "cartesian") this.cleanupCartesian();
			if(this.current_mode == "parametric") this.cleanupParametric();
			if(this.current_mode == "convex-hull") this.cleanupConvexHull();
		}
		this.current_mode = params.source;
		//Init new 
		if(this.current_mode == "cartesian") this.initCartesian();
		if(this.current_mode == "parametric") this.initParametric();
		if(this.current_mode == "convex-hull") this.initConvexHull();

	}

	// >>>>>>>>>> Cartesian mode functions 
	Mode2D.prototype.initCartesian = function(){
		// Create the edge data 
		this.edgeData = this.leftView.array({
			width: this.edgeArray.length/2,
			items: 2,
			channels: 2,
			data: this.edgeArray,
			id: "cartesian_edge_data"
		});
		// Draw the geometry
		this.leftView.vector({
			points: this.edgeData,
			color: this.gui.colors.data,
			width: 5,
			start: false,
			opacity:1,
			id: "cartesian_geometry"
		});

		this.parseCartesian();
		this.polygonizeCartesian();
	}
	Mode2D.prototype.parseCartesian = function(){
		var equation_string = this.gui.params.equation;
		let sides = equation_string.split('=');
		let LHS = sides[0];
		let RHS = sides[1];
		let LHSfunc = Parser.parse(LHS).toJSFunction(['x','y']);
		let RHSfunc = Parser.parse(RHS).toJSFunction(['x','y']);
		this.cartesian_equation =  function(x,y) { return LHSfunc(x,y) - RHSfunc(x,y); };
	}
	Mode2D.prototype.polygonizeCartesian = function(){
		var params = this.gui.params
		if(this.cartesian_equation == null) return; //Cannot draw without a parsed equation
		//Parses the equation, and polygonizes it 
		try {
			this.edgeArray = [];
			this.edgeArray = Polygonize.generate(this.cartesian_equation, [[-10, 10], [-10, 10]], params.resolution);

			this.edgeData.set("width", this.edgeArray.length/2);
			this.edgeData.set("data", this.edgeArray);
		} catch(err){
			console.log("Error rendering equation",err)
		}
	}
	Mode2D.prototype.cleanupCartesian = function(){
		this.leftView.remove("#cartesian_edge_data");
		this.leftView.remove("#cartesian_geometry");
	}
	

	// >>>>>>>>>>> Parametric mode functions
	Mode2D.prototype.initParametric = function(){}
	Mode2D.prototype.cleanupParametric = function(){}

	//  >>>>>>>>>>> Convex Hull mode functions
	Mode2D.prototype.initConvexHull = function(){
		this.parseConvexPoints()
		var pointsArray = this.pointsArray;

		// Set the data
		this.leftView.array({
			expr: function (emit, i, t) {
				for(var j=0;j<pointsArray.length;j++) emit(pointsArray[j][0], pointsArray[j][1]);
		    },
		    width: 1,
		    items:pointsArray.length,
		    channels: 2,
		    id:'hull_data'
		})
		// Draw the geometry 
		this.leftView.face({
			color:this.gui.colors.data,
			id:'hull_geometry',
			points:'#hull_data',
		})
	}
	Mode2D.prototype.parseConvexPoints = function(){
		var params = this.gui.params
		// Get string of points and parse it 
		// Remove whitespace 
		var points_str = params.points.replace(/\s+/g, '');
		// Split based on the pattern (digits,digits)
		var points_split = points_str.match(/\(-*\d+,-*\d+\)/g);
		this.pointsArray = []

		for(var i=0;i<points_split.length;i++){
			var p = points_split[i];
			// Remove parenthesis 
			p = p.replace(/[\(\)]/g,'');
			// Split by comma
			var comma_split = p.split(",") 
			var point = []
			for(var j=0;j<comma_split.length;j++) point.push(Number(comma_split[j]))
			this.pointsArray.push(point)
		}
		
	}
	Mode2D.prototype.updateConvexHull = function(){
		// Re-parse
		this.parseConvexPoints();
		var pointsArray = this.pointsArray;
		// Update the data 
		this.leftView.select("#hull_data").set("items",pointsArray.length)
		this.leftView.select("#hull_data").set("expr",function(emit,i,t){
			for(var j=0;j<pointsArray.length;j++) emit(pointsArray[j][0], pointsArray[j][1]);
		})
	}
	Mode2D.prototype.cleanupConvexHull = function(){
		this.leftView.remove("#hull_data")
		this.leftView.remove("#hull_geometry")
	}

	// Creates a new mathbox view
	Mode2D.prototype.createView = function(el,width){
		var mathbox = mathBox({
		  element: el,
		  size: {width:width,height:window.innerHeight-50},
	      plugins: ['core', 'controls', 'cursor', 'mathbox'],
	      controls: {
	        // Orbit controls, i.e. Euler angles, with gimbal lock
	        klass: THREE.OrbitControls,
	        // Trackball controls, i.e. Free quaternion rotation
	        //klass: THREE.TrackballControls,
	      },
	    });
	    if (mathbox.fallback) throw "WebGL not supported"
	    // Set the renderer color 
		mathbox.three.renderer.setClearColor(new THREE.Color(0xFFFFFF), 1.0);
		return mathbox;
	}

	//Destroys everything created
	Mode2D.prototype.cleanup = function(){
		// Destroy mathbox overlays
		var overlays = this.document.querySelector(".mathbox-overlays");
		overlays.parentNode.removeChild(overlays);
		// Destroy the canvas element 
		var canvas = this.document.querySelector("canvas");
		canvas.parentNode.removeChild(canvas);
		// Remove the two child divs 
		this.leftChild.parentNode.removeChild(this.leftChild);
		this.rightChild.parentNode.removeChild(this.rightChild);

		// Destroy gui 
		this.gui.cleanup();
	}

	scope.Mode2D = Mode2D;
	return Mode2D;
})(typeof exports === 'undefined' ? {} : exports);