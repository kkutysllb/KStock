(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var COLORS = ["#117a8b", "#d97706", "#475569", "#b45309", "#0f766e", "#be123c"];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function svgElement(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function values(chart) {
    var data = Array.isArray(chart.data) ? chart.data : [];
    return data.map(function (row) { return Number(row.value); }).filter(function (value) { return isFinite(value); });
  }

  function chartFrame(title) {
    var frame = element("figure", "dashboard-chart");
    frame.appendChild(element("figcaption", "dashboard-chart-title", title || "图表"));
    return frame;
  }

  function lineChart(chart) {
    var frame = chartFrame(chart.title);
    var data = Array.isArray(chart.data) ? chart.data : [];
    var nums = values(chart);
    if (!nums.length) return fallbackChart(chart, frame);
    var min = Math.min.apply(Math, nums), max = Math.max.apply(Math, nums);
    var span = max - min || 1;
    var plot = svgElement("svg", { viewBox: "0 0 720 250", role: "img", "aria-label": chart.title || "趋势图" });
    plot.appendChild(svgElement("line", { x1: 48, y1: 205, x2: 690, y2: 205, stroke: "#cbd5e1" }));
    plot.appendChild(svgElement("line", { x1: 48, y1: 24, x2: 48, y2: 205, stroke: "#cbd5e1" }));
    var points = nums.map(function (value, index) {
      var x = 56 + (index * 626 / Math.max(nums.length - 1, 1));
      var y = 195 - ((value - min) / span) * 155;
      return x + "," + y;
    }).join(" ");
    plot.appendChild(svgElement("polyline", { points: points, fill: "none", stroke: COLORS[0], "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    nums.forEach(function (value, index) {
      var x = 56 + (index * 626 / Math.max(nums.length - 1, 1));
      var y = 195 - ((value - min) / span) * 155;
      var circle = svgElement("circle", { cx: x, cy: y, r: 4, fill: COLORS[0] });
      circle.appendChild(element("title", "", String(data[index].time || "") + ": " + value));
      plot.appendChild(circle);
    });
    frame.appendChild(plot);
    return frame;
  }

  function barChart(chart) {
    var frame = chartFrame(chart.title);
    var data = Array.isArray(chart.data) ? chart.data : [];
    var nums = values(chart);
    if (!nums.length) return fallbackChart(chart, frame);
    var max = Math.max.apply(Math, nums) || 1;
    var plot = svgElement("svg", { viewBox: "0 0 720 250", role: "img", "aria-label": chart.title || "分类图" });
    plot.appendChild(svgElement("line", { x1: 48, y1: 205, x2: 690, y2: 205, stroke: "#cbd5e1" }));
    var width = 610 / nums.length;
    nums.forEach(function (value, index) {
      var height = Math.max(2, value / max * 165);
      var x = 58 + index * width;
      var y = 200 - height;
      var bar = svgElement("rect", { x: x, y: y, width: Math.max(8, width - 8), height: height, rx: 3, fill: COLORS[index % COLORS.length] });
      bar.appendChild(element("title", "", String(data[index].category || "") + ": " + value));
      plot.appendChild(bar);
      var label = svgElement("text", { x: x + width / 2, y: 224, "text-anchor": "middle", fill: "#475569", "font-size": 11 });
      label.textContent = String(data[index].category || "");
      plot.appendChild(label);
    });
    frame.appendChild(plot);
    return frame;
  }

  function pieChart(chart) {
    var frame = chartFrame(chart.title);
    var data = Array.isArray(chart.data) ? chart.data : [];
    var total = data.reduce(function (sum, row) { return sum + Number(row.value || 0); }, 0);
    if (!total) return fallbackChart(chart, frame);
    var plot = svgElement("svg", { viewBox: "0 0 720 250", role: "img", "aria-label": chart.title || "组成图" });
    var cx = 170, cy = 125, radius = 88, angle = -Math.PI / 2;
    data.forEach(function (row, index) {
      var next = angle + Number(row.value || 0) / total * Math.PI * 2;
      var large = next - angle > Math.PI ? 1 : 0;
      var x1 = cx + radius * Math.cos(angle), y1 = cy + radius * Math.sin(angle);
      var x2 = cx + radius * Math.cos(next), y2 = cy + radius * Math.sin(next);
      var path = svgElement("path", { d: "M " + cx + " " + cy + " L " + x1 + " " + y1 + " A " + radius + " " + radius + " 0 " + large + " 1 " + x2 + " " + y2 + " Z", fill: COLORS[index % COLORS.length] });
      path.appendChild(element("title", "", String(row.category || "") + ": " + row.value));
      plot.appendChild(path);
      var legend = svgElement("text", { x: 330, y: 44 + index * 24, fill: "#475569", "font-size": 12 });
      legend.textContent = String(row.category || "") + "  " + row.value;
      plot.appendChild(legend);
      angle = next;
    });
    frame.appendChild(plot);
    return frame;
  }

  function scatterChart(chart) {
    var frame = chartFrame(chart.title);
    var data = Array.isArray(chart.data) ? chart.data : [];
    if (!data.length) return fallbackChart(chart, frame);
    var xs = data.map(function (row) { return Number(row.x); }).filter(isFinite);
    var ys = data.map(function (row) { return Number(row.y); }).filter(isFinite);
    var minX = Math.min.apply(Math, xs), maxX = Math.max.apply(Math, xs), minY = Math.min.apply(Math, ys), maxY = Math.max.apply(Math, ys);
    var plot = svgElement("svg", { viewBox: "0 0 720 250", role: "img", "aria-label": chart.title || "相关性图" });
    data.forEach(function (row, index) {
      var x = 56 + ((Number(row.x) - minX) / (maxX - minX || 1)) * 630;
      var y = 195 - ((Number(row.y) - minY) / (maxY - minY || 1)) * 165;
      var point = svgElement("circle", { cx: x, cy: y, r: 5, fill: COLORS[index % COLORS.length], opacity: 0.85 });
      point.appendChild(element("title", "", String(row.x) + ", " + String(row.y)));
      plot.appendChild(point);
    });
    frame.appendChild(plot);
    return frame;
  }

  function fallbackChart(chart, frame) {
    frame.classList.add("dashboard-chart-fallback");
    var note = element("p", "dashboard-chart-note", chart.reason || "当前图表使用结构化表格呈现。");
    frame.appendChild(note);
    var data = chart.data;
    if (Array.isArray(data) && data.length) {
      var table = element("table", "dashboard-data-table");
      var head = element("tr");
      Object.keys(data[0]).forEach(function (key) { head.appendChild(element("th", "", key)); });
      table.appendChild(head);
      data.slice(0, 12).forEach(function (row) {
        var tr = element("tr");
        Object.keys(data[0]).forEach(function (key) { tr.appendChild(element("td", "", row[key])); });
        table.appendChild(tr);
      });
      frame.appendChild(table);
    }
    return frame;
  }

  function renderChart(chart) {
    if (chart.args && typeof chart.args === "object") {
      chart = Object.assign({}, chart.args, chart);
    }
    if (chart.status === "fallback") return fallbackChart(chart, chartFrame(chart.title));
    if (chart.tool === "generate_line_chart" || chart.tool === "generate_area_chart") return lineChart(chart);
    if (chart.tool === "generate_bar_chart" || chart.tool === "generate_column_chart") return barChart(chart);
    if (chart.tool === "generate_pie_chart") return pieChart(chart);
    if (chart.tool === "generate_scatter_chart") return scatterChart(chart);
    return fallbackChart(chart, chartFrame(chart.title));
  }

  function mount(root, payload) {
    root.textContent = "";
    var nav = element("nav", "dashboard-nav");
    var content = element("main", "dashboard-content");
    (payload.sections || []).forEach(function (section) {
      var id = "section-" + String(section.id).replace(/[^a-zA-Z0-9_-]/g, "-");
      var button = element("button", "dashboard-nav-item", section.title);
      button.type = "button";
      button.addEventListener("click", function () { document.getElementById(id).scrollIntoView({ behavior: "smooth" }); });
      nav.appendChild(button);
      var block = element("section", "dashboard-section status-" + section.status);
      block.id = id;
      var header = element("div", "dashboard-section-header");
      header.appendChild(element("h2", "", section.title));
      header.appendChild(element("span", "dashboard-status", section.status));
      block.appendChild(header);
      block.appendChild(element("p", "dashboard-summary", section.summary));
      var metrics = element("div", "dashboard-metrics");
      (section.metrics || []).forEach(function (metric) {
        var card = element("article", "dashboard-metric");
        card.appendChild(element("span", "dashboard-metric-label", metric.label));
        card.appendChild(element("strong", "dashboard-metric-value", String(metric.value) + (metric.unit ? " " + metric.unit : "")));
        card.appendChild(element("small", "dashboard-metric-meta", String(metric.source) + " · " + String(metric.as_of)));
        metrics.appendChild(card);
      });
      block.appendChild(metrics);
      var charts = element("div", "dashboard-charts");
      (section.charts || []).forEach(function (chart) { charts.appendChild(renderChart(chart)); });
      block.appendChild(charts);
      if (section.gaps && section.gaps.length) {
        var gaps = element("ul", "dashboard-gaps");
        section.gaps.forEach(function (gap) { gaps.appendChild(element("li", "", gap)); });
        block.appendChild(gaps);
      }
      content.appendChild(block);
    });
    root.appendChild(nav);
    root.appendChild(content);
  }

  window.KStockDashboard = { mount: mount };
}());
