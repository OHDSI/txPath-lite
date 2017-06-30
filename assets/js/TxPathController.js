angular.module('myapp', [])
.controller('TxPathController', function ($scope, $http) {
    $scope.started = false;
    $scope.showtable = false;  
    $scope.firstTime= true;

    var data = {};
    // var vis = null;
    
    // D3 Stuff
    // Dimensions of sunburst.
    var width = 650;
    var height = 500;
    var radius = Math.min(width, height) / 2;

    // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
    var b = {
      w: 145, h: 25, s: 2, t: 5
    };

    // Mapping of step names to color.
    //SUNBURST WORKS WITH MORE/LESS OPTIONS
    var color = d3.scale.category20();

    // Total size of all segments; we set this later, after loading the data.
    $scope.totalSize = 0; 
    $scope.nodes = {};

    // var vis = d3.select("#chart").append("svg:svg")
    //     .attr("width", width)
    //     .attr("height", height)
    //     .append("svg:g")
    //     .attr("id", "container")
    //     .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    // var partition = d3.layout.partition()
    //     .size([2 * Math.PI, radius * radius])
    //     .value(function(d) { return d.size; });

    // var arc = d3.svg.arc()
    //     .startAngle(function(d) { return d.x; })
    //     .endAngle(function(d) { return d.x + d.dx; })
    //     .innerRadius(function(d) { return Math.sqrt(d.y); })
    //     .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });

    $.ajax({
            url: '/WebAPI/conceptset',
            // url: 'http://localhost:8080/WebAPI/conceptset',
            type: 'GET',
            error: function() {
              console.log("noConcept");
            },
            success: function (result) {
              $scope.$apply(function(){
                $scope.concepts = result
              });
            }
    });
    $.ajax({
            url: 'WebAPI/cohortdefinition',
            // url: 'http://localhost:8080/WebAPI/cohortdefinition',
            type: 'GET',
            error: function() {
              console.log("noCohort");
            },
            success:function (result) {
              $scope.$apply(function(){
                $scope.cohorts = result;
              });
            }
    });
    $scope.submitSelect = function() {
        $scope.loading = true;
        $scope.showTable = false;
        if ($scope.firstTime == false){
          console.log("It's not my first time.");
          data = {};
          $scope.totalSize=0;
          d3.selectAll('svg').remove();
        }
        if ($scope.selectedCohort != null && $scope.selectedConcept != null){
          $scope.started = true; //temporary, put in other feedback later
          $.ajax({
            // url: '/WebAPI/mimic/txPathways/' + $scope.selectedCohort + '/' + $scope.selectedConcept,
            url: 'http://localhost:8080/WebAPI/mimic/txPathways/' + $scope.selectedCohort + '/' + $scope.selectedConcept,
            type: 'GET',
            error: function() {
              console.log("noTxPath");
            },
            success: function(data) {
              // d3.select("svg").remove();
              console.log(data);
              console.log("data-ing");
              var json = buildHierarchy(data.pathways);
              $scope.loading = false;
              $scope.nodes = createVisualization(json);
              console.log($scope.nodes[0].children);
              $scope.showtable = true;
              $scope.$apply(function(){
                $scope.tableData = $scope.nodes[0].children;
              });
              $scope.firstTime = false;
            }
          });
        } else {
          alert("Please select a cohort and concept");
        };
    }
    

  // Main function to draw and set up the visualization, once we have the data.
  function createVisualization(json) {
    // Basic setup of page elements.
    // if ($scope.firstTime != true){
    //   console.log("It's not my first time.");
      var vis = d3.select("#chart").append("svg:svg")
            .attr("width", width)
            .attr("height", height)
            .append("svg:g")
            .attr("id", "container")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
      var partition = d3.layout.partition()
        .size([2 * Math.PI, radius * radius])
        .value(function(d) { return d.size; });

      var arc = d3.svg.arc()
          .startAngle(function(d) { return d.x; })
          .endAngle(function(d) { return d.x + d.dx; })
          .innerRadius(function(d) { return Math.sqrt(d.y); })
          .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });
    // }
    

    initializeBreadcrumbTrail();
    // drawLegend();
    d3.select("#togglelegend").on("click", toggleLegend);

    // Bounding circle underneath the sunburst, to make it easier to detect
    // when the mouse leaves the parent g.
    vis.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);

    //For efficiency, filter nodes to keep only those large enough to see.
    var nodes = partition.nodes(json)
        .filter(function(d) {
        return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
        });


    var path = vis.data([json]).selectAll("path")
        .data(nodes)
        .enter().append("svg:path")
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("fill",function(d,i){return color(i);})
        .style("opacity", 1)
        .on("mouseover", mouseover);

    // Add the mouseleave handler to the bounding circle.
    d3.select("#container").on("mouseleave", mouseleave);

    // Get total size of the tree = value of root node from partition.
    $scope.totalSize = path.node().__data__.value;
    return nodes;

   };

  // Fade all but the current sequence, and show it in the breadcrumb trail.
  function mouseover(d) {
    var vis = d3.select("#chart").select("svg");
    var percentage = (100 * d.value / $scope.totalSize).toPrecision(3);
    var percentageString = percentage + "%";
    if (percentage < 0.1) {
      percentageString = "< 0.1%";
    }

    d3.select("#percentage")
        .text(percentageString);

    d3.select("#explanation")
        .style("visibility", "");

    var sequenceArray = getAncestors(d);
    updateBreadcrumbs(sequenceArray, percentageString);

    // Fade all the segments.
    d3.selectAll("path")
        .style("opacity", 0.3);

    // Then highlight only those that are an ancestor of the current segment.
    vis.selectAll("path")
        .filter(function(node) {
                  return (sequenceArray.indexOf(node) >= 0);
                })
        .style("opacity", 1);
  }

  // Restore everything to full opacity when moving off the visualization.
  function mouseleave(d) {

    // Hide the breadcrumb trail
    d3.select("#trail")
        .style("visibility", "hidden");

    // Deactivate all segments during transition.
    d3.selectAll("path").on("mouseover", null);

    // Transition each segment to full opacity and then reactivate it.
    d3.selectAll("path")
        .transition()
        .duration(1000)
        .style("opacity", 1)
        .each("end", function() {
                d3.select(this).on("mouseover", mouseover);
              });

    d3.select("#explanation")
        .style("visibility", "hidden");
  }

  // Given a node in a partition layout, return an array of all of its ancestor
  // nodes, highest first, but excluding the root.
  function getAncestors(node) {
    var path = [];
    var current = node;
    while (current.parent) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  }

  function initializeBreadcrumbTrail() {
    // Add the svg area.
    var trail = d3.select("#sequence").append("svg:svg")
        .attr("width",1600)
        .attr("height", 25)
        .attr("id", "trail");
    // Add the label at the end, for the percentage.
    trail.append("svg:text")
      .attr("id", "endlabel")
      .style("fill", "#000");
  }

  // Generate a string that describes the points of a breadcrumb polygon.
  function breadcrumbPoints(d, i) {
    var points = [];
    points.push("0,0");
    points.push(b.w + ",0");
    points.push(b.w + b.t + "," + (b.h / 2));
    points.push(b.w + "," + b.h);
    points.push("0," + b.h);
    if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
      points.push(b.t + "," + (b.h / 2));
    }
    return points.join(" ");
  }

  // Update the breadcrumb trail to show the current sequence and percentage.
  function updateBreadcrumbs(nodeArray, percentageString) {

    // Data join; key function combines name and depth (= position in sequence).
    var g = d3.select("#trail")
        .selectAll("g")
        .data(nodeArray, function(d) { return d.name + d.depth; });

    // Add breadcrumb and label for entering nodes.
    var entering = g.enter().append("svg:g");

    // entering.append("svg:polygon")
    //     .attr("points", breadcrumbPoints)
    //     .style("fill", function(d) { return color[d.name]; });

    entering.append("svg:text")
        .attr("x", ((b.w) / 2))
        .attr("y", b.h / 2)
        .attr("dy", "0.25em")
        .attr("text-anchor", "left")
        .text(function(d) { return d.name; });

    // Set position for entering and updating nodes.
    g.attr("transform", function(d, i) {
      return "translate(" + i * (b.w + b.s) + ", 0)";
    });

    // Remove exiting nodes.
    g.exit().remove();

    // Now move and update the percentage at the end.
    d3.select("#trail").select("#endlabel")
        .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(percentageString);

    // Make the breadcrumb trail visible, if it's hidden.
    d3.select("#trail")
        .style("visibility", "");

  }

  function drawLegend() {
    var li = {
      w: 75, h: 30, s: 3, r: 3
    };

    var legend = d3.select("#legend").append("svg:svg")
        .attr("width", li.w)
        .attr("height", d3.keys(color).length * (li.h + li.s));

    var g = legend.selectAll("g")
        .data(d3.entries(color))
        .enter().append("svg:g")
        .attr("transform", function(d, i) {
                return "translate(0," + i * (li.h + li.s) + ")";
             });

    g.append("svg:rect")
        .attr("rx", li.r)
        .attr("ry", li.r)
        .attr("width", li.w)
        .attr("height", li.h)
        .style("fill", function(d) { return d.value; });

    g.append("svg:text")
        .attr("x", li.w / 2)
        .attr("y", li.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.key; });
  }

  function toggleLegend() {
    var legend = d3.select("#legend");
    if (legend.style("visibility") == "hidden") {
      legend.style("visibility", "");
    } else {
      legend.style("visibility", "hidden");
    }
  }

  function buildHierarchy(json) {
    var jsons = [];
    var path = "";
    var size = 0;

    for (var j=0; j<json.length; j++){
      var obj = json[j];    
      for (var key in obj){
        if (obj[key] == null){
          continue;
        } else if (isNaN(obj[key])){
          path+= (obj[key] + "-");
        } else{
          size=obj[key];
        }
      }
      path = path.slice(0, -1);
      jsons[j]=[path,size];
      path = "";
      size = 0;
    }
    var children = [];
    var root = {"name": "root", "children": []};
    for (var i = 0; i < jsons.length; i++) {
      var sequence = jsons[i][0];
      var size = +jsons[i][1];
      if (isNaN(size)) { // e.g. if this is a header row
        continue;
      }
      var parts = sequence.split("-"); //arrays of sequences
      var currentNode = root;
      for (var j = 0; j < parts.length; j++) {
        children = currentNode["children"];
        if (children == undefined){
          children = [];
        }
        var nodeName = parts[j];
        var childNode;
        if (j + 1 < parts.length) {
          // Not yet at the end of the sequence; move down the tree.
          var foundChild = false;
            for (var k = 0; k < children.length; k++) {
            if (children[k]["name"] == nodeName) {
              childNode = children[k];
              foundChild = true;
              break;
            }
          }
          
          // If we don't already have a child node for this branch, create it.
            if (!foundChild) {
              childNode = {"name": nodeName, "children": []};
              children.push(childNode);
            }
            currentNode = childNode;
              } else {
            // Reached the end of the sequence; create a leaf node.
            childNode = {"name": nodeName, "size": size};
            children.push(childNode);
          }
        }
      }
    return root;
  };
});