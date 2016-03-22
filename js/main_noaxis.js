/***********************************************
* A JavaScript document by Carl Sack           *
* D3 Coordinated Visualization Example Code    *
* Creative Commons 3.0 license, 2015           *
***********************************************/

//wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["varA", "varB", "varC", "varD", "varE"]; //list of attributes
var expressed = attrArray[0]; //initial attribute
// var chartWidth = window.innerWidth * 0.425,
// 	chartHeight = 460;

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
	//map frame dimensions
	var width = window.innerWidth * 0.5,
		height = 460;

	//create new svg container for the map
	var map = d3.select("body")
		.append("svg")
		.attr("class", "map")
		.attr("width", width)
		.attr("height", height);

	//create Albers equal area conic projection centered on France
	var projection = d3.geo.albers()
		.center([0, 46.2])
		.rotate([-2, 0])
		.parallels([43, 62])
		.scale(2500)
		.translate([width / 2, height / 2]);

	var path = d3.geo.path()
		.projection(projection);

	//use queue.js to parallelize asynchronous data loading
	queue()
		.defer(d3.csv, "data/unitsData.csv") //load attributes from csv
		.defer(d3.json, "data/EuropeCountries.topojson") //load background spatial data
		.defer(d3.json, "data/FranceRegions.topojson") //load choropleth spatial data
		.await(callback);

	function callback(error, csvData, europe, france){

		//place graticule on the map
		setGraticule(map, path);
		
		//translate europe and France TopoJSONs
		var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries),
			franceRegions = topojson.feature(france, france.objects.FranceRegions).features;
		
		//add Europe countries to map
		var countries = map.append("path")
			.datum(europeCountries)
			.attr("class", "countries")
			.attr("d", path);

		//join csv data to GeoJSON enumeration units
		franceRegions = joinData(franceRegions, csvData);

		//create the color scale
		var colorScale = makeColorScale(csvData);

		//add enumeration units to the map
		setEnumerationUnits(franceRegions, map, path, colorScale);

		//add coordinated visualization to the map
		setChart(csvData, colorScale);
	};
}; //end of setMap()

function setGraticule(map, path){
	//create graticule generator
	var graticule = d3.geo.graticule()
		.step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

	//create graticule background
	var gratBackground = map.append("path")
		.datum(graticule.outline()) //bind graticule background
		.attr("class", "gratBackground") //assign class for styling
		.attr("d", path) //project graticule

	//create graticule lines	
	var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
		.data(graticule.lines()) //bind graticule lines to each element to be created
	  	.enter() //create an element for each datum
		.append("path") //append each element to the svg as a path element
		.attr("class", "gratLines") //assign class for styling
		.attr("d", path); //project graticule lines
};

function joinData(franceRegions, csvData){
	//loop through csv to assign each set of csv attribute values to geojson region
	for (var i=0; i<csvData.length; i++){
		var csvRegion = csvData[i]; //the current region
		var csvKey = csvRegion.adm1_code; //the CSV primary key

		//loop through geojson regions to find correct region
		for (var a=0; a<franceRegions.length; a++){
			
			var geojsonProps = franceRegions[a].properties; //the current region geojson properties
			var geojsonKey = geojsonProps.adm1_code; //the geojson primary key

			//where primary keys match, transfer csv data to geojson properties object
			if (geojsonKey == csvKey){

				//assign all attributes and values
				attrArray.forEach(function(attr){
					var val = parseFloat(csvRegion[attr]); //get csv attribute value
					geojsonProps[attr] = val; //assign attribute and value to geojson properties
				});
			};
		};
	};

	return franceRegions;
};

function setEnumerationUnits(franceRegions, map, path, colorScale){

	//add France regions to map
	var regions = map.selectAll(".regions")
		.data(franceRegions)
		.enter()
		.append("path")
		.attr("class", function(d){
			return "regions " + d.properties.adm1_code;
		})
		.attr("d", path)
		.style("fill", function(d){
			return choropleth(d.properties, colorScale);
		});
};

//function to create color scale generator
function makeColorScale(data){
	var colorClasses = [
		"#D4B9DA",
		"#C994C7",
		"#DF65B0",
		"#DD1C77",
		"#980043"
	];

	/*//QUANTILE SCALE
	//create color scale generator
	var colorScale = d3.scale.quantile()
		.range(colorClasses);

	//build array of all values of the expressed attribute
	var domainArray = [];
	for (var i=0; i<data.length; i++){
		var val = parseFloat(data[i][expressed]);
		domainArray.push(val);
	};

	//assign array of expressed values as scale domain
	colorScale.domain(domainArray);
	*/

	/*//EQUAL INTERVAL SCALE
	//create color scale generator
	var colorScale = d3.scale.quantile()
		.range(colorClasses);

	//build two-value array of minimum and maximum expressed attribute values
	var minmax = [
		d3.min(data, function(d) { return parseFloat(d[expressed]); }), 
		d3.max(data, function(d) { return parseFloat(d[expressed]); })
	];
	//assign two-value array as scale domain
	colorScale.domain(minmax);
	*/

	//NATURAL BREAKS SCALE
	//create color scale generator
	var colorScale = d3.scale.threshold()
		.range(colorClasses);

	//build array of all values of the expressed attribute
	var domainArray = [];
	for (var i=0; i<data.length; i++){
		var val = parseFloat(data[i][expressed]);
		domainArray.push(val);
	};

	//cluster data using ckmeans clustering algorithm to create natural breaks
	var clusters = ss.ckmeans(domainArray, 5);
	//reset domain array to cluster minimums
	domainArray = clusters.map(function(d){
		return d3.min(d);
	});
	//remove first value from domain array to create class breakpoints
	domainArray.shift();

	//assign array of last 4 cluster minimums as domain
	colorScale.domain(domainArray);

	return colorScale;
};

//function to test for data value and return color
function choropleth(props, colorScale){
	//make sure attribute value is a number
	var val = parseFloat(props[expressed]);
	//if attribute value exists, assign a color; otherwise assign gray
	if (val && val != NaN){
		return colorScale(val);
	} else {
		return "#CCC";
	};
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
	//chart frame dimensions
	var chartWidth = window.innerWidth * 0.425,
		chartHeight = 460;

	//create a second svg element to hold the bar chart
	var chart = d3.select("body")
		.append("svg")
		.attr("width", chartWidth)
		.attr("height", chartHeight)
		.attr("class", "chart");

	//create a scale to size bars proportionally to frame
	var yScale = d3.scale.linear()
		.range([0, chartHeight])
		.domain([0, 105]);

	//set bars for each province
	var bars = chart.selectAll(".bars")
		.data(csvData)
		.enter()
		.append("rect")
		.sort(function(a, b){
			return a[expressed]-b[expressed]
		})
		.attr("class", function(d){
			return "bars " + d.adm1_code;
		})
		.attr("width", chartWidth / csvData.length - 1)
		.attr("x", function(d, i){
			return i * (chartWidth / csvData.length);
		})
		.attr("height", function(d){
			return yScale(parseFloat(d[expressed]));
		})
		.attr("y", function(d){
			return chartHeight - yScale(parseFloat(d[expressed]));
		})
		.style("fill", function(d){
			return choropleth(d, colorScale);
		});

	//annotate bars with attribute value text
	var numbers = chart.selectAll(".numbers")
		.data(csvData)
		.enter()
		.append("text")
		.sort(function(a, b){
			return a[expressed]-b[expressed]
		})
		.attr("class", function(d){
			return "numbers " + d.adm1_code;
		})
		.attr("text-anchor", "middle")
		.attr("x", function(d, i){
			var fraction = chartWidth / csvData.length;
			return i * fraction + (fraction - 1) / 2;
		})
		.attr("y", function(d){
			return chartHeight - yScale(parseFloat(d[expressed])) + 15;
		})
		.text(function(d){
			return d[expressed];
		});

	//create a text element for the chart title
	var chartTitle = chart.append("text")
		.attr("x", 20)
		.attr("y", 40)
		.attr("class", "chartTitle")
		.text("Number of Variable " + expressed[3] + " in each region");
};

})();