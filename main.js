window.addEventListener('load', () => {
  const attributeDefinitions = [
    { key: 'type', label: 'Vehicle type', candidates: ['type'], kind: 'category' },
    { key: 'awd', label: 'All-wheel drive', radarLabel: 'AWD', unit: '', candidates: ['awd'], kind: 'number' },
    { key: 'rwd', label: 'Rear-wheel drive', radarLabel: 'RWD', unit: '', candidates: ['rwd'], kind: 'number' },
    { key: 'price', label: 'Retail price', radarLabel: 'Retail price', unit: '$', candidates: ['retail price'], kind: 'number' },
    { key: 'cost', label: 'Dealer cost', radarLabel: 'Dealer cost', unit: '$', candidates: ['dealer cost'], kind: 'number' },
    { key: 'engine', label: 'Engine size (L)', radarLabel: 'Engine size', unit: 'L', candidates: ['engine size (l)'], kind: 'number' },
    { key: 'cylinders', label: 'Cylinders', radarLabel: 'Cylinders', unit: 'cyl', candidates: ['cyl'], kind: 'number' },
    { key: 'horsepower', label: 'Horsepower', radarLabel: 'Horsepower', unit: 'HP', candidates: ['horsepower(hp)', 'horsepower'], kind: 'number' },
    { key: 'cityMpg', label: 'City MPG', radarLabel: 'City MPG', unit: 'mpg', candidates: ['city miles per gallon'], kind: 'number' },
    { key: 'highwayMpg', label: 'Highway MPG', radarLabel: 'Highway MPG', unit: 'mpg', candidates: ['highway miles per gallon'], kind: 'number' },
    { key: 'weight', label: 'Weight', radarLabel: 'Weight', unit: 'lb', candidates: ['weight'], kind: 'number' },
    { key: 'wheelbase', label: 'Wheelbase', radarLabel: 'Wheelbase', unit: 'in', candidates: ['wheel base', 'wheelbase'], kind: 'number' },
    { key: 'length', label: 'Length', radarLabel: 'Length', unit: 'in', candidates: ['len', 'length'], kind: 'number' },
    { key: 'width', label: 'Width', radarLabel: 'Width', unit: 'in', candidates: ['width'], kind: 'number' }
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
  let selectedVehicleId = null;

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
    renderDetails();
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
    const options = d3.select('#attribute-list').selectAll('.attribute-option').data(availableAttributes, attribute => attribute.key)
      .join(enter => {
        const option = enter.append('div').attr('class', 'attribute-option');
        const choice = option.append('label').attr('class', 'attribute-choice');
        choice.append('input').attr('type', 'checkbox');
        choice.append('span').attr('class', 'attribute-name');
        option.append('span').attr('class', 'order-index');
        const orderControls = option.append('span').attr('class', 'order-controls');
        orderControls.append('button').attr('type', 'button').attr('class', 'order-button move-up')
          .text('↑').on('click', function (attribute) { moveAttribute(attribute.key, -1); });
        orderControls.append('button').attr('type', 'button').attr('class', 'order-button move-down')
          .text('↓').on('click', function (attribute) { moveAttribute(attribute.key, 1); });
        return option;
      });

    options.each(function (attribute) {
      const option = d3.select(this);
      option.select('label').attr('for', `attribute-${attribute.key}`);
      option.select('input').attr('id', `attribute-${attribute.key}`).attr('value', attribute.key)
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
          updateAttributeControlState();
          renderMatrix();
        });
      option.select('.attribute-name').text(attribute.label);
      option.select('.move-up').attr('aria-label', `Move ${attribute.label} up in the matrix`);
      option.select('.move-down').attr('aria-label', `Move ${attribute.label} down in the matrix`);
    });

    d3.select('#reset-selection').on('click', () => {
      selectedKeys = defaultKeys.filter(key => availableAttributes.some(attribute => attribute.key === key));
      if (selectedKeys.length < 2) selectedKeys = availableAttributes.slice(0, 2).map(attribute => attribute.key);
      document.getElementById('selection-message').textContent = '';
      updateSelectionCount();
      updateAttributeControlState();
      renderMatrix();
    });

    updateSelectionCount();
    updateAttributeControlState();
  }

  function updateAttributeControlState() {
    d3.select('#attribute-list').selectAll('.attribute-option').each(function (attribute) {
      const option = d3.select(this);
      const order = selectedKeys.indexOf(attribute.key);
      const selected = order >= 0;
      option.classed('is-selected', selected);
      option.select('input').property('checked', selected);
      option.select('.order-index').text(selected ? order + 1 : '');
      option.select('.move-up').property('disabled', !selected || order === 0);
      option.select('.move-down').property('disabled', !selected || order === selectedKeys.length - 1);
    });
  }

  function moveAttribute(key, offset) {
    const currentIndex = selectedKeys.indexOf(key);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= selectedKeys.length) return;
    const [attribute] = selectedKeys.splice(currentIndex, 1);
    selectedKeys.splice(targetIndex, 0, attribute);
    updateAttributeControlState();
    renderMatrix();
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

  function formatOriginalValue(value, attribute) {
    if (value == null) return 'Not available';
    const formatted = formatNumber(value);
    if (attribute.unit === '$') return `$${formatted}`;
    return attribute.unit ? `${formatted} ${attribute.unit}` : formatted;
  }

  function normalizeForRadar(value, attribute) {
    if (value == null) return null;
    if (attribute.key === 'awd' || attribute.key === 'rwd') return Math.max(0, Math.min(1, value));
    const extent = d3.extent(records, record => record[attribute.key] == null ? undefined : record[attribute.key]);
    if (extent[0] == null || extent[1] == null) return null;
    if (extent[0] === extent[1]) return 0.5;
    return Math.max(0, Math.min(1, (value - extent[0]) / (extent[1] - extent[0])));
  }

  function showRadarTooltip(event, record, attribute) {
    const value = formatOriginalValue(record[attribute.key], attribute);
    tooltip.html(`<strong>${escapeHtml(record.name)}</strong>${escapeHtml(attribute.label)}: ${escapeHtml(value)}`)
      .style('left', `${event.clientX + 13}px`)
      .style('top', `${event.clientY + 13}px`)
      .style('opacity', 1);
  }

  function renderDetails() {
    const record = records.find(item => item.id === selectedVehicleId);
    const content = d3.select('#details-content');
    const typeChip = document.getElementById('selected-type');
    content.html('');

    if (!record) {
      typeChip.hidden = true;
      const empty = content.append('div').attr('class', 'empty-state');
      empty.append('span').attr('class', 'empty-icon').attr('aria-hidden', 'true').text('✳');
      empty.append('p').text('Select a point in the scatterplot matrix to view its vehicle profile.');
      return;
    }

    typeChip.hidden = false;
    typeChip.textContent = record.type;
    const summary = content.append('div').attr('class', 'selected-vehicle-heading');
    summary.append('h3').text(record.name);
    summary.append('p').text(`${record.type} · Selected in the scatterplot matrix`);

    const detailsGrid = content.append('div').attr('class', 'details-grid');
    const starPanel = detailsGrid.append('section').attr('class', 'star-panel');
    starPanel.append('h3').text('Normalized attribute profile');
    starPanel.append('p').attr('class', 'detail-hint').text('Values are scaled from 0 to 1 across the dataset. Hover over an axis to see the original value.');
    renderStarPlot(starPanel, record);

    const valuesPanel = detailsGrid.append('section').attr('class', 'values-panel');
    valuesPanel.append('h3').text('Original values');
    valuesPanel.append('p').attr('class', 'detail-hint').text('Measurements use the units from the dataset.');
    const valueRows = [
      { label: 'Name', value: record.name },
      { label: 'Vehicle type', value: record.type },
      ...availableAttributes.filter(attribute => attribute.kind === 'number').map(attribute => ({
        label: attribute.label,
        value: formatOriginalValue(record[attribute.key], attribute)
      }))
    ];
    const table = valuesPanel.append('table').attr('class', 'original-values');
    const body = table.append('tbody');
    const rows = body.selectAll('tr').data(valueRows).join('tr');
    rows.append('th').attr('scope', 'row').text(row => row.label);
    rows.append('td').text(row => row.value);
  }

  function renderStarPlot(container, record) {
    const radarAttributes = availableAttributes.filter(attribute => attribute.kind === 'number');
    const width = 500;
    const height = 410;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 138;
    const angleFor = index => 2 * Math.PI * index / radarAttributes.length - Math.PI / 2;
    const pointAt = (index, value) => ({
      x: centerX + Math.cos(angleFor(index)) * radius * value,
      y: centerY + Math.sin(angleFor(index)) * radius * value
    });

    const svg = container.append('svg').attr('class', 'star-plot')
      .attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
      .attr('aria-label', `Star plot for ${record.name} with ${radarAttributes.length} normalized vehicle attributes`);
    const plot = svg.append('g');

    [0.25, 0.5, 0.75, 1].forEach(level => {
      plot.append('circle').attr('class', 'radar-grid')
        .attr('cx', centerX).attr('cy', centerY).attr('r', radius * level);
      plot.append('text').attr('class', 'radar-scale-label')
        .attr('x', centerX + 4).attr('y', centerY - radius * level - 3).text(level.toFixed(2));
    });

    const values = radarAttributes.map((attribute, index) => ({
      attribute,
      index,
      normalized: normalizeForRadar(record[attribute.key], attribute)
    }));
    const axes = plot.selectAll('.radar-axis').data(values).join('g').attr('class', 'radar-axis')
      .on('mouseenter', function (item) { showRadarTooltip(d3.event, record, item.attribute); })
      .on('mousemove', function (item) { showRadarTooltip(d3.event, record, item.attribute); })
      .on('mouseleave', function () { tooltip.style('opacity', 0); });

    axes.append('line').attr('class', 'radar-spoke')
      .attr('x1', centerX).attr('y1', centerY)
      .attr('x2', (item, index) => centerX + Math.cos(angleFor(index)) * radius)
      .attr('y2', (item, index) => centerY + Math.sin(angleFor(index)) * radius);
    axes.append('text').attr('class', 'radar-label')
      .attr('x', (item, index) => centerX + Math.cos(angleFor(index)) * (radius + 22))
      .attr('y', (item, index) => centerY + Math.sin(angleFor(index)) * (radius + 22))
      .attr('text-anchor', (item, index) => {
        const cosine = Math.cos(angleFor(index));
        return cosine > 0.25 ? 'start' : cosine < -0.25 ? 'end' : 'middle';
      })
      .attr('dy', (item, index) => Math.sin(angleFor(index)) > 0.65 ? '1em' : Math.sin(angleFor(index)) < -0.65 ? '-.3em' : '.35em')
      .text(item => item.attribute.radarLabel);

    const line = d3.line().defined(item => item.normalized !== null)
      .x(item => pointAt(item.index, item.normalized).x)
      .y(item => pointAt(item.index, item.normalized).y);
    const complete = values.every(item => item.normalized !== null);
    const path = line(values);
    if (path) {
      plot.append('path').attr('class', complete ? 'radar-area' : 'radar-area radar-incomplete')
        .attr('d', complete ? `${path}Z` : path);
    }
    plot.selectAll('.radar-value').data(values.filter(item => item.normalized !== null)).join('circle')
      .attr('class', 'radar-value')
      .attr('cx', item => pointAt(item.index, item.normalized).x)
      .attr('cy', item => pointAt(item.index, item.normalized).y)
      .attr('r', 3.2);
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
        .attr('role', 'button').attr('tabindex', 0)
        .attr('aria-label', record => `${record.name}, ${record.type}. Select vehicle.`)
        .attr('cx', record => padding.left + xPosition(record))
        .attr('cy', record => padding.top + yPosition(record))
        .attr('r', record => record.id === selectedVehicleId ? 4.6 : 2.6)
        .attr('fill', record => colors(record.type))
        .style('opacity', record => selectedVehicleId === null || record.id === selectedVehicleId ? 0.76 : 0.12)
        .classed('selected', record => record.id === selectedVehicleId)
        .on('mouseenter', function (record) {
          d3.select(this).raise();
          showTooltip(d3.event, record, xAttribute, yAttribute);
        })
        .on('mousemove', function (record) { showTooltip(d3.event, record, xAttribute, yAttribute); })
        .on('click', function (record) { selectVehicle(record); })
        .on('keydown', function (record) {
          if (d3.event.key === 'Enter' || d3.event.key === ' ') {
            d3.event.preventDefault();
            selectVehicle(record);
          }
        })
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

  function selectVehicle(record) {
    selectedVehicleId = record.id;
    tooltip.style('opacity', 0);
    renderMatrix();
    renderDetails();
  }
});
