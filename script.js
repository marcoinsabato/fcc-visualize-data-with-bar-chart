// Cache DOM elements
const DOM = {
    chartContainer: document.querySelector("#chart-container"),
    blockedInfo: document.querySelector("#blocked-info"),
    tooltip: document.querySelector("#tooltip"),
    comparison: document.querySelector("#comparison"),
    totalItems: document.querySelector('#total-items'),
    maxValue: document.querySelector('#max-value'),
    minValue: document.querySelector('#min-value'),
    avgIncrease: document.querySelector('#avg-increase')
};

// Utility functions
const formatGDP = (gdp) => `$${parseFloat(gdp).toFixed(2)} Billion`;

const calculateDateDifference = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const yearsDiff = d1.getFullYear() - d2.getFullYear();
    const monthsDiff = d1.getMonth() - d2.getMonth();
    const totalMonths = yearsDiff * 12 + monthsDiff;
    const absMonths = Math.abs(totalMonths);
    return `${Math.floor(absMonths / 12)} years and ${absMonths % 12} months`;
};

const renderInfoCard = (date, gdp) => `
    <div class="space-y-1">
        <div><span class="font-medium">Date:</span> ${date}</div>
        <div><span class="font-medium">GDP:</span> ${formatGDP(gdp)}</div>
    </div>
`;

// Update blocked info DOM
const updateBlockedInfoDOM = (info) => {
    DOM.blockedInfo.innerHTML = info === null 
        ? 'Click a bar to block details'
        : renderInfoCard(info.date, info.gdp);
};

// Proxy for reactive state management
const blockedInfoState = { value: null };
const blockedInfo = new Proxy(blockedInfoState, {
    set(target, property, value) {
        target[property] = value;
        if (property === 'value') {
            updateBlockedInfoDOM(value);
        }
        return true;
    }
});

const calculateAverageIncrease = (data) => {
    const increases = data.map(([d, v] , i) =>{ 
        if (i === 0) return v;
        return parseFloat(v) - parseFloat(data[i - 1][1])
    });

    return (increases.reduce((a, b) => a + b, 0) / increases.length).toFixed(2);
};


// Event handlers
const handleBarClick = (event, date, gdp) => {
    document.querySelectorAll('.bar').forEach(bar => bar.classList.remove('fill-indigo-500'));
    event.currentTarget.classList.add('fill-indigo-500');
    blockedInfo.value = { date, gdp };
};

const handleBarMouseOver = (date, gdp) => {
    DOM.tooltip.innerHTML = renderInfoCard(date, gdp);
    DOM.tooltip.setAttribute('data-date', date);
    DOM.tooltip.classList.remove('hidden');

    if (blockedInfo.value) {
        const gdpDiff = (parseFloat(gdp) - parseFloat(blockedInfo.value.gdp)).toFixed(2);
        const dateDiff = calculateDateDifference(date, blockedInfo.value.date);
        
        DOM.comparison.innerHTML = `
            <div class="space-y-1">
                <div><span class="font-medium">Date:</span> ${dateDiff}</div>
                <div><span class="font-medium">GDP:</span> <span class="${gdpDiff > 0 ? 'text-green-500' : 'text-red-500'}">$${gdpDiff} Billions</span></div>
            </div>
        `;
    }
};

const handleBarMouseOut = () => {
    DOM.tooltip.classList.add('hidden');
    DOM.comparison.innerHTML = '';
};

// Main chart generation
const generateChart = async () => {
    const response = await fetch("https://raw.githubusercontent.com/freeCodeCamp/ProjectReferenceData/master/GDP-data.json");
    const { data } = await response.json();
    
    DOM.chartContainer.innerHTML = "";

    // Chart dimensions
    const fullwidth = DOM.chartContainer.offsetWidth;
    const fullheight = 600;
    const padding = 50;
    const width = fullwidth - padding;
    const height = fullheight - 2 * padding;
    
    // Calculate data ranges
    const dates = data.map(([d]) => new Date(d));
    const values = data.map(([, v]) => v);
    
    const minDate = d3.min(dates);
    const maxDate = d3.max(dates);
    const minValue = d3.min(values);
    const maxValue = d3.max(values);
    
    // Extend date range for better visualization
    const minDateExtended = new Date(minDate);
    const maxDateExtended = new Date(maxDate);
    minDateExtended.setMonth(minDate.getMonth() - 3);
    maxDateExtended.setMonth(maxDate.getMonth() + 3);
    
    // Update statistics
    DOM.totalItems.textContent = data.length;
    DOM.maxValue.textContent = maxValue;
    DOM.minValue.textContent = minValue;
    DOM.avgIncrease.textContent = calculateAverageIncrease(data);

    const barWidth = width / data.length;
    
    // Define scales
    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([height, 0]);
    
    const xScale = d3.scaleTime()
        .domain([minDateExtended, maxDateExtended])
        .range([padding, width + padding / 2]);
    
    // Define axes
    const yAxis = d3.axisLeft(yScale);
    const xAxis = d3.axisBottom(xScale);
    
    // Create SVG
    const svg = d3.select("#chart-container")
        .append("svg")
        .attr("width", fullwidth)
        .attr("height", fullheight);
    
    // Add axes
    svg.append('g')
        .attr('id', 'x-axis')
        .attr('transform', `translate(0, ${height + padding})`)
        .call(xAxis);
    
    svg.append('g')
        .attr('id', 'y-axis')
        .attr('transform', `translate(${padding}, ${padding})`)
        .call(yAxis);
    
    // Create bars
    svg.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", ([d]) => xScale(new Date(d)))
        .attr("y", ([, v]) => yScale(v) + padding)
        .attr("width", barWidth)
        .attr("height", ([, v]) => height - yScale(v))
        .attr('data-date', ([d]) => d)
        .attr('data-gdp', ([, v]) => v)
        .attr('class', 'bar fill-teal-400 hover:fill-indigo-500')
        .on('click', (ev) => {
            const date = ev.currentTarget.getAttribute('data-date');
            const gdp = ev.currentTarget.getAttribute('data-gdp');
            handleBarClick(ev, date, gdp);
        })
        .on('mouseover', (ev) => {
            const date = ev.currentTarget.getAttribute('data-date');
            const gdp = ev.currentTarget.getAttribute('data-gdp');
            handleBarMouseOver(date, gdp);
        })
        .on('mouseout', handleBarMouseOut);
};

// Debounce function to optimize resize performance
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// Initialize chart and observe resize with debouncing
const debouncedGenerateChart = debounce(generateChart, 500);

const resizeObserver = new ResizeObserver(() => {
    debouncedGenerateChart();
});

resizeObserver.observe(DOM.chartContainer);

// Initial chart generation
generateChart();
