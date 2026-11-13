window.addEventListener('load', () => {
  const defaults = [
    { key: 'type', label: 'Vehicle type', candidates: ['type'] },
    { key: 'price', label: 'Retail price', candidates: ['retail price'] },
    { key: 'horsepower', label: 'Horsepower', candidates: ['horsepower(hp)', 'horsepower'] },
    { key: 'weight', label: 'Weight', candidates: ['weight'] }
  ];
  const numericKeys = ['price', 'horsepower', 'weight'];
  // D3 v5 includes schemeCategory10, but not schemeTableau10.
  const colors = d3.scaleOrdinal(d3.schemeCategory10);
  const tooltip = d3.select('#tooltip');
  const formatNumber = d3.format(',');
  const cellSize = 184;
  const padding = { top: 20, right: 9, bottom: 44, left: 43 };
  const plotWidth = cellSize - padding.left - padding.right;
  const plotHeight = cellSize - padding.top - padding.bottom;
  const gap = 8;

  function normalizedHeader(value) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function numericValue(value) {
    if (value == null || String(value).trim() === '') return null;
    const cleaned = String(value).trim().replace(/[$,]/g, '');
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  function setError(message) {
    const error = document.getElementById('load-error');
    error.textContent = message;
    error.hidden = false;
  }

  d3.csv('cars.csv').then(rows => {
    if (!rows.length) throw new Error('The cars.csv file contains no vehicle records.');

    const headers = Object.keys(rows[0]);
    const headerLookup = new Map(headers.map(header => [normalizedHeader(header), header]));
    const sourceColumns = {};
    defaults.forEach(attribute => {
      sourceColumns[attribute.key] = attribute.candidates.map(normalizedHeader).map(name => headerLookup.get(name)).find(Boolean);
      if (!sourceColumns[attribute.key]) throw new Error(`Required attribute "${attribute.label}" is missing from cars.csv.`);
    });
    const nameColumn = headerLookup.get('name');
    const records = rows.map((row, index) => {
      const name = nameColumn && row[nameColumn] ? row[nameColumn].trim() : `Vehicle ${index + 1}`;
      const type = row[sourceColumns.type] && row[sourceColumns.type].trim() || 'Unknown';
      return {
        id: index,
        name,
        type,
        price: numericValue(row[sourceColumns.price]),
        horsepower: numericValue(row[sourceColumns.horsepower]),
        weight: numericValue(row[sourceColumns.weight])
      };
    });
    const validRecords = records.filter(record => numericKeys.some(key => record[key] !== null));
    if (!validRecords.length) throw new Error('No valid numeric vehicle values could be read.');
    colors.domain(Array.from(new Set(validRecords.map(record => record.type))).sort(d3.ascending));

    document.getElementById('vehicle-count').textContent = `${validRecords.length} vehicles · ${colors.domain().length} vehicle types`;
    renderLegend();
    renderMatrix(validRecords);
  }).catch(error => {
    console.error(error);
    setError(`Could not load vehicle data. ${error.message} Run the page from a local web server so cars.csv can be read.`);
  });

  function renderLegend() {
    const items = d3.select('#legend').selectAll('.legend-item').data(colors.domain()).join('div').attr('class', 'legend-item');
    items.append('span').attr('class', 'legend-dot').style('background-color', type => colors(type));
    items.append('span').text(type => type);
  }

  function showTooltip(event, record, xAttribute, yAttribute) {
    const value = (key) => {
      if (key === 'type') return record.type;
      return record[key] == null ? 'Not available' : formatNumber(record[key]);
    };
    tooltip.html(`<strong>${escapeHtml(record.name)}</strong>${escapeHtml(record.type)}<br>${escapeHtml(xAttribute.label)}: ${value(xAttribute.key)}<br>${escapeHtml(yAttribute.label)}: ${value(yAttribute.key)}`)
      .style('left', `${event.clientX + 13}px`)
      .style('top', `${event.clientY + 13}px`)
      .style('opacity', 1);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function renderMatrix(data) {
    const width = defaults.length * (cellSize + gap) - gap + padding.left;
    const height = defaults.length * (cellSize + gap) - gap + padding.bottom;
    const svg = d3.select('#matrix').append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Four by four scatterplot matrix: vehicle type, retail price, horsepower, and weight');
    const typeDomain = colors.domain();
    const typeScale = d3.scalePoint().domain(typeDomain).range([0, plotWidth]).padding(0.35);
    const typeYScale = d3.scalePoint().domain(typeDomain).range([plotHeight, 0]).padding(0.35);
    const scales = {};

    defaults.forEach(attribute => {
      if (attribute.key === 'type') {
        scales[attribute.key] = typeScale;
      } else {
        const extent = d3.extent(data, record => record[attribute.key]);
        const adjusted = extent[0] === extent[1] ? [extent[0] - 1, extent[1] + 1] : extent;
        scales[attribute.key] = d3.scaleLinear().domain(adjusted).nice(3).range([0, plotWidth]);
      }
    });

    const cells = [];
    defaults.forEach((yAttribute, row) => defaults.forEach((xAttribute, column) => {
      cells.push({ xAttribute, yAttribute, row, column });
    }));

    const cell = svg.selectAll('.cell').data(cells).join('g').attr('class', 'cell')
      .attr('transform', d => `translate(${padding.left + d.column * (cellSize + gap)},${8 + d.row * (cellSize + gap)})`);

    cell.append('rect').attr('class', d => d.row === d.column ? 'cell-frame cell-diagonal' : 'cell-frame')
      .attr('width', cellSize).attr('height', cellSize);

    cell.filter(d => d.row === d.column).append('text').attr('class', 'diagonal-label')
      .attr('x', cellSize / 2).attr('y', cellSize / 2).attr('text-anchor', 'middle')
      .text(d => d.xAttribute.label);

    cell.each(function (descriptor) {
      const group = d3.select(this);
      const { xAttribute, yAttribute, row, column } = descriptor;
      if (row === column) return;

      const xPosition = record => {
        const base = scales[xAttribute.key](record[xAttribute.key]);
        return xAttribute.key === 'type' ? base + jitter(record.id, column) : base;
      };
      const yPosition = record => {
        const base = yAttribute.key === 'type' ? typeYScale(record[yAttribute.key]) : plotHeight - scales[yAttribute.key](record[yAttribute.key]);
        return yAttribute.key === 'type' ? base + jitter(record.id, row) : base;
      };
      const points = data.filter(record => record[xAttribute.key] !== null && record[yAttribute.key] !== null);
      group.selectAll('circle').data(points).join('circle').attr('class', 'point')
        .attr('cx', record => padding.left + xPosition(record))
        .attr('cy', record => padding.top + yPosition(record))
        .attr('r', 2.7).attr('fill', record => colors(record.type))
        .on('mouseenter', function (record) {
          d3.select(this).raise();
          showTooltip(d3.event, record, xAttribute, yAttribute);
        })
        .on('mousemove', function (record) { showTooltip(d3.event, record, xAttribute, yAttribute); })
        .on('mouseleave', function () { tooltip.style('opacity', 0); });

      // Show both axis titles and tick values in every scatterplot cell.
      group.append('text').attr('class', 'axis-title x-axis-title')
        .attr('x', padding.left + plotWidth / 2).attr('y', 13)
        .attr('text-anchor', 'middle').text(xAttribute.label);
      group.append('text').attr('class', 'axis-title y-axis-title')
        .attr('transform', `translate(${cellSize - 4},${padding.top + plotHeight / 2}) rotate(90)`)
        .attr('text-anchor', 'middle').text(yAttribute.label);

      const yAxis = group.append('g').attr('transform', `translate(${padding.left},${padding.top})`);
      if (yAttribute.key === 'type') {
        yAxis.call(d3.axisLeft(typeYScale).tickSize(0));
      } else {
        const yScale = d3.scaleLinear().domain(scales[yAttribute.key].domain()).range([plotHeight, 0]);
        yAxis.call(d3.axisLeft(yScale).ticks(3).tickFormat(d3.format('~s')).tickSize(0));
      }
      yAxis.selectAll('text').attr('class', 'grid-label').attr('dx', '-.2em');
      yAxis.select('.domain').remove();

      const xAxis = group.append('g').attr('transform', `translate(${padding.left},${padding.top + plotHeight})`);
      if (xAttribute.key === 'type') {
        xAxis.call(d3.axisBottom(typeScale).tickSize(0));
        xAxis.selectAll('.tick text').attr('class', 'grid-label')
          .attr('text-anchor', 'end').attr('transform', 'rotate(-45)').attr('dx', '-.35em').attr('dy', '.2em');
      } else {
        xAxis.call(d3.axisBottom(scales[xAttribute.key]).ticks(3).tickFormat(d3.format('~s')).tickSize(0));
        xAxis.selectAll('text').attr('class', 'grid-label').attr('dy', '1.1em');
      }
      xAxis.select('.domain').remove();
    });
  }

  function jitter(id, salt) {
    const value = Math.sin((id + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return (value - Math.floor(value) - 0.5) * 10;
  }
});
