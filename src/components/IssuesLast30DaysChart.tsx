import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { CalendarDays, BarChart, TrendingUp, Filter } from 'lucide-react';
import { Issue } from '../types';

interface IssuesLast30DaysChartProps {
  issues: Issue[];
}

interface DailyDataPoint {
  dateObj: Date;
  dateStr: string; // YYYY-MM-DD for keying
  displayLabel: string; // "Jun 29"
  count: number;
  filteredCount: number;
}

export default function IssuesLast30DaysChart({ issues }: IssuesLast30DaysChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 340, height: 180 });
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Categories list for filtering
  const categories = useMemo(() => {
    return ['All', 'Roads', 'Drainage', 'Streetlight', 'Sanitation', 'Water', 'Public Safety', 'Electrical'];
  }, []);

  // Compute list of the last 30 days
  const last30Days = useMemo(() => {
    const list: DailyDataPoint[] = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      
      const displayLabel = d.toLocaleString('default', { month: 'short', day: 'numeric' });
      
      // Calculate how many issues were created on this day
      const dailyIssues = issues.filter(issue => {
        if (!issue.createdAt) return false;
        // Match start of ISO string YYYY-MM-DD
        return issue.createdAt.startsWith(dateStr);
      });

      const count = dailyIssues.length;
      
      const filteredCount = dailyIssues.filter(issue => {
        if (selectedCategory === 'All') return true;
        return issue.category === selectedCategory;
      }).length;

      list.push({
        dateObj: d,
        dateStr,
        displayLabel,
        count,
        filteredCount
      });
    }
    return list;
  }, [issues, selectedCategory]);

  // Handle ResizeObserver for responsive sizing as requested
  useEffect(() => {
    if (!containerRef.current) return;

    let timeoutId: number;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          setDimensions({
            width: Math.max(280, width),
            height: 180,
          });
        }, 100);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, []);

  // Render D3 Chart
  useEffect(() => {
    if (!svgRef.current || last30Days.length === 0) return;

    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll('*').remove();

    const margin = { top: 15, right: 10, bottom: 25, left: 20 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svgElement
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (for 30 discrete days, band scale works beautifully for both bars & area points)
    const x = d3
      .scaleBand()
      .domain(last30Days.map((d: DailyDataPoint) => d.displayLabel))
      .range([0, width])
      .padding(0.2);

    // Y Scale (auto-scaling to max count, with min scale limit to look proportional)
    const maxVal = (d3.max(last30Days, (d: DailyDataPoint) => d.filteredCount) as number) || 4;
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(4, maxVal + 1)]) // Minimum height of 4 to look beautiful even with sparse data
      .range([height, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .attr('opacity', 0.05)
      .selectAll('line')
      .data(y.ticks(4))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', (d: number) => y(d))
      .attr('y2', (d: number) => y(d))
      .attr('stroke', '#31211A')
      .attr('stroke-width', 1);

    // X Axis - Show every 5th label to prevent text crowding
    const xAxis = d3.axisBottom(x)
      .tickFormat((d: string, i: number) => (i % 5 === 0 || i === last30Days.length - 1) ? d : '')
      .tickSize(3);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .call((g) => g.select('.domain').attr('stroke', '#E2E8F0'))
      .call((g) => g.selectAll('.tick text').attr('fill', '#94A3B8').attr('font-size', '8px'));

    // Y Axis
    const yAxis = d3.axisLeft(y)
      .ticks(Math.min(5, Math.max(4, maxVal + 1)))
      .tickFormat(d3.format('d'))
      .tickSize(3);

    g.append('g')
      .call(yAxis)
      .call((g) => g.select('.domain').attr('stroke', '#E2E8F0'))
      .call((g) => g.selectAll('.tick text').attr('fill', '#94A3B8').attr('font-size', '8px'));

    // Render logic based on user selected chart type
    if (chartType === 'bar') {
      // Create Gradient definition for bars
      const defs = svgElement.append('defs');
      const gradId = 'bar-gradient';
      const gradient = defs
        .append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      // Use gorgeous coral colors to match app branding
      gradient.append('stop').attr('offset', '0%').attr('stop-color', '#f97316');
      gradient.append('stop').attr('offset', '100%').attr('stop-color', '#fca5a5');

      // Add Bars
      g.selectAll('.bar')
        .data(last30Days)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d: DailyDataPoint) => x(d.displayLabel) || 0)
        .attr('y', (d: DailyDataPoint) => y(d.filteredCount))
        .attr('width', x.bandwidth())
        .attr('height', (d: DailyDataPoint) => height - y(d.filteredCount))
        .attr('fill', `url(#${gradId})`)
        .attr('rx', 2) // subtle rounded corners
        .attr('cursor', 'pointer')
        .attr('opacity', 0.85)
        .on('mouseover', function() {
          d3.select(this).attr('opacity', 1).attr('stroke', '#ea580c').attr('stroke-width', 1);
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 0.85).attr('stroke', null);
        });

    } else {
      // Area/Line Chart Rendering
      const defs = svgElement.append('defs');
      const areaGradId = 'area-gradient-30d';
      const areaGrad = defs
        .append('linearGradient')
        .attr('id', areaGradId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f97316').attr('stop-opacity', 0.25);
      areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f97316').attr('stop-opacity', 0.0);

      // Monotone X Curve Line
      const lineGenerator = d3
        .line<DailyDataPoint>()
        .x((d: DailyDataPoint) => (x(d.displayLabel) || 0) + x.bandwidth() / 2)
        .y((d: DailyDataPoint) => y(d.filteredCount))
        .curve(d3.curveMonotoneX);

      const areaGenerator = d3
        .area<DailyDataPoint>()
        .x((d: DailyDataPoint) => (x(d.displayLabel) || 0) + x.bandwidth() / 2)
        .y0(height)
        .y1((d: DailyDataPoint) => y(d.filteredCount))
        .curve(d3.curveMonotoneX);

      // Draw Area
      g.append('path')
        .datum(last30Days)
        .attr('fill', `url(#${areaGradId})`)
        .attr('d', areaGenerator);

      // Draw Line
      g.append('path')
        .datum(last30Days)
        .attr('fill', 'none')
        .attr('stroke', '#f97316')
        .attr('stroke-width', 2)
        .attr('d', lineGenerator);

      // Draw subtle points on top
      g.selectAll('.dot')
        .data(last30Days.filter((d: DailyDataPoint) => d.filteredCount > 0))
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', (d: DailyDataPoint) => (x(d.displayLabel) || 0) + x.bandwidth() / 2)
        .attr('cy', (d: DailyDataPoint) => y(d.filteredCount))
        .attr('r', 3)
        .attr('fill', '#ffffff')
        .attr('stroke', '#f97316')
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer');
    }

    // INTERACTIVE TRACKING OVERLAY & TOOLTIPS
    const tooltipGroup = g.append('g').style('display', 'none');
    
    // Vertical trace line
    const verticalLine = tooltipGroup
      .append('line')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-dasharray', '2,2')
      .attr('y1', 0)
      .attr('y2', height);

    svgElement
      .append('rect')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => tooltipGroup.style('display', null))
      .on('mouseout', () => {
        tooltipGroup.style('display', 'none');
        d3.select('#day30-tooltip').style('opacity', 0);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, svgRef.current);
        const relativeX = mx - margin.left;

        // Calculate index corresponding to coordinates
        const xDomain = last30Days.map((d) => d.displayLabel);
        const eachBandWidth = width / xDomain.length;
        let closestIdx = Math.floor(relativeX / eachBandWidth);
        closestIdx = Math.max(0, Math.min(last30Days.length - 1, closestIdx));

        const d = last30Days[closestIdx];
        const selectedX = (x(d.displayLabel) || 0) + x.bandwidth() / 2;

        verticalLine.attr('x1', selectedX).attr('x2', selectedX);

        // Position & fill dynamic HTML Tooltip
        const tooltip = d3.select('#day30-tooltip');
        tooltip
          .style('opacity', 1)
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 15}px`).html(`
            <div class="p-2 text-left font-sans text-[10px] space-y-1">
              <p class="font-bold text-slate-800 border-b border-beach-cream pb-0.5">${d.displayLabel}, 2026</p>
              <div class="flex items-center gap-1.5 mt-1">
                <span class="w-1.5 h-1.5 rounded-full bg-beach-coral"></span>
                <span class="text-slate-500">${selectedCategory === 'All' ? 'Total Reports' : `${selectedCategory} Reports`}:</span>
                <span class="font-bold text-slate-800">${d.filteredCount}</span>
              </div>
              ${selectedCategory !== 'All' ? `
                <div class="text-[9px] text-slate-400">
                  (Total overall reports on day: ${d.count})
                </div>
              ` : ''}
            </div>
          `);
      });

  }, [dimensions, last30Days, chartType, selectedCategory]);

  return (
    <div className="bg-white border border-beach-cream rounded-3xl p-4 shadow-sm text-left flex flex-col space-y-3.5 relative overflow-hidden">
      {/* Tooltip target element */}
      <div
        id="day30-tooltip"
        className="fixed z-50 bg-white border border-beach-cream rounded-xl shadow-lg pointer-events-none transition-opacity duration-150 opacity-0 min-w-32"
      />

      {/* Header and filters row */}
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-beach-cream/40 rounded-xl border border-beach-cream/60">
              <CalendarDays className="w-4 h-4 text-beach-coral" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider">
                Daily Report Activity
              </h3>
              <p className="text-[9px] text-slate-500">Report frequency over the last 30 days</p>
            </div>
          </div>

          {/* Toggle Type button */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[9px] font-bold">
            <button
              onClick={() => setChartType('bar')}
              title="Bar Chart"
              className={`p-1 rounded transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white text-beach-coral shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('area')}
              title="Area Curve"
              className={`p-1 rounded transition-all cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white text-beach-coral shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filters Select row */}
        <div className="flex items-center gap-2 pt-1">
          <Filter className="w-3 h-3 text-slate-400" />
          <div className="flex flex-wrap gap-1">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-beach-coral/10 text-beach-coral border-beach-coral/30 font-bold'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
            {categories.length > 5 && (
              <select
                value={categories.includes(selectedCategory) && categories.indexOf(selectedCategory) >= 5 ? selectedCategory : 'More'}
                onChange={(e) => {
                  if (e.target.value !== 'More') {
                    setSelectedCategory(e.target.value);
                  }
                }}
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-slate-50 text-slate-500 border-slate-200 focus:outline-none cursor-pointer`}
              >
                <option value="More" disabled>More...</option>
                {categories.slice(5).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div ref={containerRef} className="w-full relative h-[180px]">
        <svg ref={svgRef} className="w-full h-full overflow-visible" />
      </div>

      {/* Chart Legend */}
      <div className="flex justify-between items-center text-[9px] text-slate-400">
        <span>30 days ago</span>
        <span className="font-semibold text-slate-500">
          Total in view: {last30Days.reduce((acc, curr) => acc + curr.filteredCount, 0)} reports
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
