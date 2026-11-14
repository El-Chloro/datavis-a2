window.addEventListener('load', () => {
  const attributeDefinitions = [
    { key: 'type', label: 'Vehicle type', candidates: ['type'], kind: 'category' },
    { key: 'awd', label: 'All-wheel drive', candidates: ['awd'], kind: 'number' },
    { key: 'rwd', label: 'Rear-wheel drive', candidates: ['rwd'], kind: 'number' },
    { key: 'price', label: 'Retail price', candidates: ['retail price'], kind: 'number' },
    { key: 'cost', label: 'Dealer cost', candidates: ['dealer cost'], kind: 'number' },
    { key: 'engine', label: 'Engine size (L)', candidates: ['engine size (l)'], kind: 'number' },
    { key: 'cylinders', label: 'Cylinders', candidates: ['cyl'], kind: 'number' },
    { key: 'horsepower', label: 'Horsepower', candidates: ['horsepower(hp)', 'horsepower'], kind: 'number' },
    { key: 'cityMpg', label: 'City MPG', candidates: ['city miles per gallon'], kind: 'number' },
    { key: 'highwayMpg', label: 'Highway MPG', candidates: ['highway miles per gallon'], kind: 'number' },
    { key: 'weight', label: 'Weight', candidates: ['weight'], kind: 'number' },
    { key: 'wheelbase', label: 'Wheelbase', candidates: ['wheel base', 'wheelbase'], kind: 'number' },
    { key: 'length', label: 'Length', candidates: ['len', 'length'], kind: 'number' },
    { key: 'width', label: 'Width', candidates: ['width'], kind: 'number' }
  ];
  const defaultKeys = ['type', 'price', 'horsepower', 'weight'];
  const colors = d3.scaleOrdinal(d3.schemeCategory10);
  const tooltip = d3.select('#tooltip');
  const formatNumber = d3.format(',');
  const cellSize = 184;
  const padding = { top: 20, right: 9, bottom: 44, left: 43 };
  const plotWidth = cellSize - padding.left - padding.right;
  const plotHeight = cellSize - padding.top - padding.bottom;
  const gap = 8;
  let availableAttributes = [];
  let records = [];
  let selectedKeys = [];

  function normalizedHeader(value) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function numericValue(value) {
    if (value == null || String(value).trim() === '') return null;
    const number = Number(String(value).trim().replace(/[$,]/g, ''));
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
    const nameColumn = headerLookup.get('name');
    const sourceColumns = {};
    attributeDefinitions.forEach(attribute => {
      sourceColumns[attribute.key] = attribute.candidates.map(normalizedHeader).map(name => headerLookup.get(name)).find(Boolean);
    });

    records = rows.map((row, index) => {
      const record = {
        id: index,
        name: nameColumn && row[nameColumn] ? row[nameColumn].trim() : `Vehicle ${index + 1}`,
        type: sourceColumns.type && row[sourceColumns.type].trim() || 'Unknown'
      };
      attributeDefinitions.forEach(attribute => {
        if (attribute.kind === 'number') {
          record[attribute.key] = sourceColumns[attribute.key] ? numericValue(row[sourceColumns[attribute.key]]) : null;
        }
      });
      return record;
    });

    availableAttributes = attributeDefinitions.filter(attribute => {
      if (attribute.kind === 'category') return Boolean(sourceColumns[attribute.key]);
      return Boolean(sourceColumns[attribute.key]) && records.some(record => record[attribute.key] !== null);
    });
    if (availableAttributes.filter(attribute => attribute.kind === 'number').length < 2) {
      throw new Error('At least two usable numeric attributes are required to build the matrix.');
    }

    records = records.filter(record => availableAttributes.some(attribute => attribute.kind === 'number' && record[attribute.key] !== null));
    colors.domain(Array.from(new Set(records.map(record => record.type))).sort(d3.ascending));
    selectedKeys = defaultKeys.filter(key => availableAttributes.some(attribute => attribute.key === key));
    if (selectedKeys.length < 2) selectedKeys = availableAttributes.slice(0, 2).map(attribute => attribute.key);

    document.getElementById('vehicle-count').textContent = `${records.length} vehicles · ${colors.domain().length} vehicle types`;
    renderLegend();
    renderAttributeControls();
    renderMatrix();
  }).catch(error => {
    console.error(error);
    setError(`Could not load vehicle data. ${error.message} Run the page from a local web server so cars.csv can be read.`);
  });

  function renderLegend() {
    const items = d3.select('#legend').selectAll('.legend-item').data(colors.domain()).join('div').attr('class', 'legend-item');
    items.append('span').attr('class', 'legend-dot').style('background-color', type => colors(type));
    items.append('span').text(type => type);
  }

  function renderAttributeControls() {
    const options = d3.select('#attribute-list').selectAll('label').data(availableAttributes, attribute => attribute.key)
      .join('label').attr('class', 'attribute-option');

    options.each(function (attribute) {
      const option = d3.select(this);
      option.html('');
      option.append('input').attr('type', 'checkbox').attr('value', attribute.key)
        .property('checked', selectedKeys.includes(attribute.key))
        .on('change', function () {
          const message = document.getElementById('selection-message');
          if (!this.checked && selectedKeys.length <= 2) {
            this.checked = true;
            message.textContent = 'Select at least two attributes.';
            return;
          }
          message.textContent = '';
          if (this.checked) selectedKeys.push(attribute.key);
          else selectedKeys = selectedKeys.filter(key => key !== attribute.key);
          updateSelectionCount();
          renderMatrix();
        });
      option.append('span').text(attribute.label);
    });

    d3.select('#reset-selection').on('click', () => {
      selectedKeys = defaultKeys.filter(key => availableAttributes.some(attribute => attribute.key === key));
      if (selectedKeys.length < 2) selectedKeys = availableAttributes.slice(0, 2).map(attribute => attribute.key);
      document.getElementById('selection-message').textContent = '';
      renderAttributeControls();
      updateSelectionCount();
      renderMatrix();
    });

    updateSelectionCount();
  }

  function updateSelectionCount() {
    document.getElementById('selection-count').textContent = `${selectedKeys.length} / ${availableAttributes.length} selected`;
  }

  function showTooltip(event, record, xAttribute, yAttribute) {
    const value = attribute => {
      if (attribute.kind === 'category') return record.type;
      return record[attribute.key] == null ? 'Not available' : formatNumber(record[attribute.key]);
    };
    tooltip.html(`<strong>${escapeHtml(record.name)}</strong>${escapeHtml(record.type)}<br>${escapeHtml(xAttribute.label)}: ${escapeHtml(value(xAttribute))}<br>${escapeHtml(yAttribute.label)}: ${escapeHtml(value(yAttribute))}`)
      .style('left', `${event.clientX + 13}px`)
      .style('top', `${event.clientY + 13}px`)
      .style('opacity', 1);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function renderMatrix() {
    const selectedAttributes = selectedKeys.map(key => availableAttributes.find(attribute => attribute.key === key));
    const count = selectedAttributes.length;
    document.getElementById('matrix-size').textContent = `${count} × ${count}`;
    const scroll = document.querySelector('.chart-scroll');
    scroll.classList.toggle('large-matrix', count > 6);
    d3.select('#matrix').selectAll('*').remove();

    const width = count * (cellSize + gap) - gap + padding.left;
    const height = count * (cellSize + gap) - gap + padding.bottom;
    const svg = d3.select('#matrix').append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `${count} by ${count} scatterplot matrix: ${selectedAttributes.map(attribute => attribute.label).join(', ')}`);
    const typeDomain = colors.domain();
    const typeXScale = d3.scalePoint().domain(typeDomain).range([0, plotWidth]).padding(0.35);
    const typeYScale = d3.scalePoint().domain(typeDomain).range([plotHeight, 0]).padding(0.35);
    const scales = {};

    selectedAttributes.forEach(attribute => {
      if (attribute.kind === 'category') return;
      const extent = d3.extent(records, record => record[attribute.key] == null ? undefined : record[attribute.key]);
      const adjusted = extent[0] === extent[1] ? [extent[0] - 1, extent[1] + 1] : extent;
      scales[attribute.key] = d3.scaleLinear().domain(adjusted).nice(3).range([0, plotWidth]);
    });

    const cells = [];
    selectedAttributes.forEach((yAttribute, row) => selectedAttributes.forEach((xAttribute, column) => {
      cells.push({ xAttribute, yAttribute, row, column });
    }));

    const cell = svg.selectAll('.cell').data(cells).join('g').attr('class', 'cell')
      .attr('transform', descriptor => `translate(${padding.left + descriptor.column * (cellSize + gap)},${8 + descriptor.row * (cellSize + gap)})`);

    cell.append('rect').attr('class', descriptor => descriptor.row === descriptor.column ? 'cell-frame cell-diagonal' : 'cell-frame')
      .attr('width', cellSize).attr('height', cellSize);

    cell.filter(descriptor => descriptor.row === descriptor.column).append('text').attr('class', 'diagonal-label')
      .attr('x', cellSize / 2).attr('y', cellSize / 2).attr('text-anchor', 'middle')
      .text(descriptor => descriptor.xAttribute.label);

    cell.each(function (descriptor) {
      const group = d3.select(this);
      const { xAttribute, yAttribute, row, column } = descriptor;
      if (row === column) return;

      const xPosition = record => {
        const base = xAttribute.kind === 'category' ? typeXScale(record.type) : scales[xAttribute.key](record[xAttribute.key]);
        return xAttribute.kind === 'category' ? base + jitter(record.id, column) : base;
      };
      const yPosition = record => {
        const base = yAttribute.kind === 'category' ? typeYScale(record.type) : plotHeight - scales[yAttribute.key](record[yAttribute.key]);
        return yAttribute.kind === 'category' ? base + jitter(record.id, row) : base;
      };
      const points = records.filter(record => record[xAttribute.kind === 'category' ? 'type' : xAttribute.key] != null && record[yAttribute.kind === 'category' ? 'type' : yAttribute.key] != null);

      group.selectAll('circle').data(points).join('circle').attr('class', 'point')
        .attr('cx', record => padding.left + xPosition(record))
        .attr('cy', record => padding.top + yPosition(record))
        .attr('r', 2.6).attr('fill', record => colors(record.type))
        .on('mouseenter', function (record) {
          d3.select(this).raise();
          showTooltip(d3.event, record, xAttribute, yAttribute);
        })
        .on('mousemove', function (record) { showTooltip(d3.event, record, xAttribute, yAttribute); })
        .on('mouseleave', function () { tooltip.style('opacity', 0); });

      group.append('text').attr('class', 'axis-title x-axis-title')
        .attr('x', padding.left + plotWidth / 2).attr('y', 13)
        .attr('text-anchor', 'middle').text(xAttribute.label);
      group.append('text').attr('class', 'axis-title y-axis-title')
        .attr('transform', `translate(${cellSize - 4},${padding.top + plotHeight / 2}) rotate(90)`)
        .attr('text-anchor', 'middle').text(yAttribute.label);

      const yAxis = group.append('g').attr('transform', `translate(${padding.left},${padding.top})`);
      if (yAttribute.kind === 'category') {
        yAxis.call(d3.axisLeft(typeYScale).tickSize(0));
      } else {
        const yScale = d3.scaleLinear().domain(scales[yAttribute.key].domain()).range([plotHeight, 0]);
        yAxis.call(d3.axisLeft(yScale).ticks(3).tickFormat(d3.format('~s')).tickSize(0));
      }
      yAxis.selectAll('text').attr('class', 'grid-label').attr('dx', '-.2em');
      yAxis.select('.domain').remove();

      const xAxis = group.append('g').attr('transform', `translate(${padding.left},${padding.top + plotHeight})`);
      if (xAttribute.kind === 'category') {
        xAxis.call(d3.axisBottom(typeXScale).tickSize(0));
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
