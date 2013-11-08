// Annotated and revised script by Jay Taylor-Laird for NUOnline
// Based on work copyrighted 2010 by William Malone (www.williammalone.com)
// Used under Apache License (http://www.apache.org/licenses/LICENSE-2.0)


// ---- My Additions ---- //
/*

1 save drawing in object
2 allow user to download png of drawing
3 


*/

/* Some constants */

var canvasWidth = 600;
var canvasHeight = 400;
var purple = "#cb3594";
var green = "#659b41";
var yellow = "#ffcf33";
var brown = "#986928";
var colorErase = "#000";
var bgColor = "#FFF";

/*
	We have all these arrays to store our drawing because we actually
	redraw it every single frame! Crazy, eh? This would be much neater as a single
	Array containing Objects with all of the other data. More notes on that below!
	
	Although I cleaned up a lot of variable names for you, the example that I adapted
	this project from uses "click" to really mean "a recorded mouse position". However,
	when it came time to do a find-and-replace on "click" (other than where it's an
	actual mouseEvent), I realized that saying "placeMouseWasWhenILastLooked" was kind
	of long. So, I stuck with "click". Just know that other than the event handler for
	"click", the Arrays that store "clicks" are really storing the last recorded position
	of the drawing while the mouse was down, so it's more of a click or drag situation.
*/

// drawing Array will store all the drawing objects
var drawingArray = [];

// drawing is an object that stores a stroke
var drawing = {
	clickX : new Array(),
	clickY : new Array(),
	clickColor : new Array(),
	clickTool : new Array(),
	clickDrag : new Array(),
	clickSize : new Array()
}

/*
	variables to store our actual HTML5 canvas (which is the DOM object we are working
	on) and its context (which is what we actually draw to)
*/
 
var canvas;
var context;

var curColor = purple;
var lastColor = curColor;
var curSize = "normal";
var paint = false;
var lineWidth = 8;
var curTool = "marker";
var currentRadius = 1;

var mouseX;
var mouseY;

// our socket io connection receives drawings from the server and pushes them to our drawingArray

io.on( 'newLines', function( data ) {
    //console.log( 'newLines event recieved:', data );
	drawingArray.push(data);
	redraw();
});

io.on('getDrawing', function(data){
	sendToServer(drawingArray, 'sendDrawing');
});

io.on('sendDrawing', function(data){
	drawingArray = (data);
	redraw();
});
	
function prepareCanvas() {

	// Set up our canvas. Note that we have not done graceful degradation here
	// because we are learning about HTML 5. Next week I will show you a "shim"
	// that allows this same code to work with older versions of Internet Explorer
	// that do not have the Canvas element built in.
	
	canvas = document.getElementById('canvas');
	canvas.setAttribute('width', canvasWidth);
	canvas.setAttribute('height', canvasHeight);
	
	// Grab the 2d canvas context. From now on, we talk to this instead of the
	// entire canvas. A canvas can have only one context, but you pick "2d" or
	// "webgl" (for 3d or for accelerated graphics) for each one. Think of the context
	// as the "renderer".
	
	context = canvas.getContext("2d"); 
	
	// Fill the canvas with a white rectangle so we can see what we are doing.
	// Without this, we would be looking at a light blue canvas just like
	// our web page is light blue.
	
	context.fillStyle = 'white';
	context.fillRect(0,0,canvasWidth, canvasHeight);
	
	sendToServer(drawing, 'getDrawing');

	// sets up all the buttons and the proper highlights and actives
	var prepButtons = function(){
		
		var colorButtons = $('button', $('.color'));
		for (var i = 0; i < colorButtons.length; i++) {
			var colorButtonImgStr= "color-swatch-"+ colorButtons[i].id + ".png";
			$(colorButtons[i]).html('<img src="/images/' + colorButtonImgStr + '"</img>')
		} 
		$('#toolDisplay').css('background-color', '#BC1981');
		$('#purple').children().addClass('highlight');
		$('#chooseNormal').addClass('active');
		$('#chooseMarker').addClass('active');
	}
		
	var toolDisplay = $('toolDisplay');

	prepButtons();

	// Add mouse events
	// ----------------
	$('#canvas').mousedown(function(e) {
		// Mouse down location is calculated using values returned from jQuery
		// event.pageX and pageY are the location of the click relative to the
		// document object; this.offsetLeft and offsetTop refer to the canvas
		// offset in this case because of the $() selector syntax. We basically are
		// saying "the canvas is "this" for purposes of this event handler". One
		// of the nice things about jQuery is it gets around the problem of
		// event handlers trying to deal with something other than what you expect.
		$(this).css('cursor','none');
		mouseX = e.pageX - this.offsetLeft;
		mouseY = e.pageY - this.offsetTop;
		paint = true;
		addClick(mouseX, mouseY, false);
		redraw();
	});
	
	$('#canvas').mousemove(function(e) {
		// If we are painting, we add another mouse point.
		mouseX = e.pageX - this.offsetLeft;
		mouseY = e.pageY - this.offsetTop;
		if(paint){
			addClick(mouseX, mouseY, true);
		}
		redraw();
	});
	
	$('#canvas').mouseup(function(e){
		paint = false;

		//send drawing to socket.io
		sendToServer(drawing, 'newLines');

		//push strokes to drawingArray
		var tempdrawing = $.extend(true, {}, drawing);
		drawingArray.push(tempdrawing);

		// reset drawing object for the next stroke
		resetDrawing();
	});
	
	$('#canvas').mouseleave(function(e){
		// If we leave the canvas area, we should stop painting so that we don't
		// get weird mouse-tracking errors when we head back in.
		paint = false;
		$(this).css('cursor' , 'default');
		
		//send drawing to socket.io
		sendToServer(drawing, 'newLines');

		//push strokes to drawingArray
		var tempdrawing = $.extend(true, {}, drawing);
		drawingArray.push(tempdrawing);

		// reset drawing object for the next stroke
		resetDrawing();
	});
	
	$('#canvas').mouseover(function(e){
		$(this).css('cursor' , 'none');
	});
	
	/*	This next section sets up all of the actions associated with the
		buttons that you're going to add to!
	*/

	$("button", $('.color')).mouseover(function(e){
		$(this).css("opacity", 0.5);
	}).mouseout(function(e) {
		$(this).css("opacity", 1.0); 
	});
	$("button", $('.size,.tool')).mouseover(function(e){
		$(this).css("opacity", 0.5);
	}).mouseout(function(e) {
		$(this).css("opacity", 0.0); 
	});
	$('.color').mousedown(function(e){
		if (curTool == "eraser"){
			curTool = "marker";
			toggleActive($('#chooseMarker')); //sets active class to tool
		}
	});
	$('#colorPicker').change(function(e){
		bgColor = colorPicker.value;
		console.log(bgColor);
		clearCanvas();
		redraw();
	});
	$('#purple').mousedown(function(e){
		curColor = purple;
		$('#toolDisplay').css('background-color', curColor);
		$('img', $('#toolDisplay')).attr('src','images/marker-outline.png');
		toggleHighlight($(this));	//highlight class added
	});
	$('#green').mousedown(function(e){
		curColor = green;
		$('#toolDisplay').css('background-color', curColor);
		$('img', $('#toolDisplay')).attr('src','images/marker-outline.png');
		toggleHighlight($(this));
	});
	$('#yellow').mousedown(function(e){
		curColor = yellow;
		$('#toolDisplay').css('background-color', curColor);
		$('img', $('#toolDisplay')).attr('src','images/marker-outline.png');
		toggleHighlight($(this));
	});
	$('#brown').mousedown(function(e){
		curColor = brown;
		$('#toolDisplay').css('background-color', curColor);
		$('img', $('#toolDisplay')).attr('src','images/marker-outline.png');
		toggleHighlight($(this));
	});

	$('#chooseSmall').mousedown(function(e){
		curSize = "small";
		currentRadius = getCurrentRadius();
		toggleActive($(this));
	});
	$('#chooseNormal').mousedown(function(e){
		curSize = "normal";
		currentRadius = getCurrentRadius();
		toggleActive($(this));
	});
	$('#chooseLarge').mousedown(function(e){
		curSize = "large";
		currentRadius = getCurrentRadius();
		toggleActive($(this));
	});
	$('#chooseHuge').mousedown(function(e){
		curSize = "huge";
		currentRadius = getCurrentRadius();
		toggleActive($(this));
	});
	$('#chooseMarker').mousedown(function(e){
		curTool = "marker";
		curColor = lastColor;
		$('#toolDisplay').css('background-color', curColor);
		$('img', $('#toolDisplay')).attr('src','images/marker-outline.png');
		
		// Switch toggles the highlight class back on the last color
		switch (lastColor) {
			case "#cb3594":
				toggleHighlight($('#purple'));
				break;
			case "#659b41":
				toggleHighlight($('#green'));
				break;
			case "#ffcf33":
				toggleHighlight($('#yellow'));
				break;
			case "#986928":
				toggleHighlight($('#brown'));
				break;
			default:
				var i = 0;
				break;
		}
		$(lastColor).children().addClass("highlight");
		toggleActive($(this));
	});
	$('#chooseEraser').mousedown(function(e){
		curTool = "eraser";
		if (curColor !== bgColor){
			lastColor = curColor;
		}
		curColor = bgColor;
		toggleHighlight($(this));
		$('img', $('#toolDisplay')).attr('src','images/eraser-outline.png'); 
		$('#toolDisplay').css('background-color', '#FFF');
		toggleActive($(this));
	});
	
	$('#clearCanvas').mousedown(function(e) {
		clearCanvas(); // despite the name, not a built-in function. see below.
		resetDrawing();
		drawingArray = [];
	});
	$('#saveImage').mousedown(function(e) {
		saveCanvasDrawing(this, 'my_drawing.png');
	});
} // this ends our prepareCanvas function

/*
"addClick" adds all of the data about the current drawing or erasing position
 to the arrays that reconstruct the drawing by recording every move of the
 mouse when the button is pressed. Note that the arrays used throughout this
 script have to stay "in sync" by always pushing an element on to each one for
 each move, even if the data hasn't changed. If the code were rewritten so that
 it used a single numerically indexed array and pushed Objects containing all of
 the other data on it, we wouldn't have to worry about a sync problem and could instead
 add code that says "If no value is set for the color or size of the pen, assume it is
 the same as in the previous frame".
 
 The Boolean variable "dragging" records whether we are drawing or not.
*/


function addClick(x, y, dragging) {
	drawing.clickX.push(x);
	drawing.clickY.push(y);
	drawing.clickDrag.push(dragging);
	drawing.clickTool.push(curTool);
	if (curTool == "marker"){
		drawing.clickColor.push(curColor);
	} else if (curTool == "eraser"){
		drawing.clickColor.push("erase");
	}
	drawing.clickSize.push(curSize);
}

/*	The first line of this function is actually what clears the canvas. Note that you can
	use clearRect to remove any part of the canvas image, allowing for more efficient re-
	draws rather than re-drawing everything every time. This is an important technique
	when writing games or graphics-intensive applications, since redrawing all of a
	complex image every "frame" would be quite taxing on the system. Even our little
	drawing program here could get overwhelmed after the arrays grow too big!
	
	Since clearing the canvas actually clears it to transparent, the second and third
	lines here repeat what we did in setup. We could actually JUST use the second and
	third lines, since drawing over the canvas in white looks to the user just like
	erasing, but I wanted to make sure you understand clearRect as well */

function clearCanvas() {
	context.clearRect(0, 0, canvasWidth, canvasHeight);
	context.fillStyle = bgColor;
	context.fillRect(0,0,canvasWidth, canvasHeight);	
}

function resetDrawing(){
	drawing.clickX = new Array();
	drawing.clickY = new Array();
	drawing.clickDrag = new Array();
	drawing.clickColor = new Array();
	drawing.clickSize = new Array();
}

function toggleHighlight(target){
	$(target).siblings().children().removeClass("highlight");
	$(target).children().addClass("highlight");
	if($(target).attr('id') == "chooseEraser") {
		$("img", ".color").removeClass("highlight");
	}
}

function toggleActive(target){
	$(target).siblings().removeClass("active");
	$(target).addClass("active");
	console.log($(target).attr('id'));
}

function saveCanvasDrawing(link, filename){
	// save canvas image as data url (png format by default)
    var dataURL = canvas.toDataURL();
    $('canvasImg').src = dataURL;
	console.log('link' + link);
	console.log('url'+ dataURL);
	link.href = dataURL;
	link.download = filename;
}

function drawToolState() {
	this.color = 0;
	this.tool = 0;
	this.size = 0;
	this.changeState = function(){
	}
}

function sendToServer(data, type) {
	var sessionId = io.socket.sessionid;
    // send a 'drawCircle' event with data and sessionId to the server
    io.emit( type, data, sessionId )
}

// function that gets the radius of the drawing tool
function getCurrentRadius() {
	if (curSize == "small") {
		return 1;
	} else if (curSize == "normal") {
		return 2;
	} else if (curSize == "large") {
		return 5;
	} else if(curSize == "huge") {
		return 10;
	}
};

function redraw() {
	clearCanvas();
	var radius;

	context.lineJoin = "round";
	context.lineCap = "round";

	// draw our stored drawings (drawingArray)
	if (drawingArray[0] != undefined){
		for(var i in drawingArray) {
			if (drawingArray[0].clickX != undefined){
				for(var j=0; j < drawingArray[i].clickX.length; j++) {
					if (drawingArray[i].clickSize[j] == "small") {
						radius = 2;
					} else if (drawingArray[i].clickSize[j] == "normal") {
						radius = 5;
					} else if (drawingArray[i].clickSize[j] == "large") {
						radius = 10;
					} else if(drawingArray[i].clickSize[j] == "huge") {
						radius = 20;
					}
	
					context.beginPath();
					if (drawingArray[i].clickDrag[j] == true && j > 0) {
						context.moveTo(drawingArray[i].clickX[j-1], drawingArray[i].clickY[j-1]);
					} else {
						context.moveTo(drawingArray[i].clickX[j]-1, drawingArray[i].clickY[j]);
					}		
					context.lineTo(drawingArray[i].clickX[j], drawingArray[i].clickY[j]);
					context.closePath();
					if (drawingArray[i].clickColor[j] === "erase"){
						context.strokeStyle = bgColor;
					} else {
						context.strokeStyle = drawingArray[i].clickColor[j]; // else draw the color we stored
					}
					context.lineWidth = radius;
					context.stroke();
				}
			}
		}
	}
	
	// draw our current stroke (drawing object)		
	for(var i=0; i < drawing.clickX.length; i++) {
	
		if (drawing.clickSize[i] == "small") {
			radius = 2;
		} else if (drawing.clickSize[i] == "normal") {
			radius = 5;
		} else if (drawing.clickSize[i] == "large") {
			radius = 10;
		} else if(drawing.clickSize[i] == "huge") {
			radius = 20;
		}
	
		context.beginPath();
	
		if (drawing.clickDrag[i] == true && i > 0) {
		
			// If clickDrag[i] is true then we were dragging from last point.
			// (i.e., the mouse button was down)
			// First point of drawing clearly can't be dragged FROM, so we don't let
			// clickDrag[0] be true. In reality it shouldn't be able to be anyway, but
			// we are being extra cautious by checking for it here.
			// (We could check this more efficiently instead of every time in loop...)
			// Anyway, this starts our next line segment at the previous point set.
			
			context.moveTo(drawing.clickX[i-1], drawing.clickY[i-1]);
			
		} else {
		
			// If clickDrag[i] is false (or we are at the first point) then 
			// we are making a dot. To ensure the dot shows up, we "cheat" and start
			// the dot one pixel over from where we REALLY clicked so that the
			// "lineTo" command that follows will draw something (lineTo the exact
			// same point draws nothing, regardless of pen width). We could rewrite
			// this to have dot-making be a separate operation not using lineTo...
			
			context.moveTo(drawing.clickX[i]-1, drawing.clickY[i]);
		}
		
		// This line actually draws our segment (or point -- hey, it's still more accurate
		// than a touchscreen!)
		
		context.lineTo(drawing.clickX[i], drawing.clickY[i]);
		context.closePath();
		
		// Now that we've made our path, we apply the current color and marker
		// radius to the line we drew. This is another area where this script could
		// be improved: you could draw a single path made of many line segments (as
		// long as there wasn't a color, tool size, or tool change). This would also then
		// enable you to make a "create filled shape" tool by using context.fill()
		// after closing the path and before moving on to the next one

		//This checks the color of the line drawn. if it is str "erase" match the line color to bgColor
		if (drawing.clickColor[i] === "erase"){
			context.strokeStyle = bgColor;
		} else {
			context.strokeStyle = drawing.clickColor[i]; // else draw the color we stored
		}
		context.lineWidth = radius;
		context.stroke();
	}

	// display our cursor with the current radius size and color
	context.beginPath();
	context.lineWidth= (2);
	context.strokeStyle = curColor;
	context.arc(mouseX, mouseY, currentRadius, 0, Math.PI*2, true); 
	context.closePath();
	context.stroke();

}