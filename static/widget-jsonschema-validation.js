import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import Ajv from 'https://esm.sh/ajv@8';

export class JsonSchemaValidationWidget extends LitElement {
    // Shared cache for agent data across all widget instances
    static agentCache = {
        data: null,
        timestamp: 0,
        ttl: 30000, // 30 seconds
        fetchPromise: null // To deduplicate concurrent requests
    };

    static styles = css`
      div {
        width: 100%;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        overflow-y: auto;
        font-size: 11px;
        font-family: sans-serif;
        background: transparent;
        color: inherit;
        line-height: 1.0;
        align-items: flex-start;
        justify-content: flex-start;
      }

      .validation-container {
        margin: 0 1px 1px 1px;
        padding: 1px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
        width: calc(100% - 4px);
      }

      @media (prefers-color-scheme: dark) {
        .validation-container {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
      }

      .validation-header {
        font-weight: bold;
        margin-bottom: 1px;
        color: inherit;
      }

      .validation-results {
        font-size: 10px;
        color: inherit;
        margin: 0 0 0 4px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: calc(100% - 4px);
        font-family: monospace;
      }

      .valid {
        color: green;
      }

      .invalid {
        color: red;
      }

      .error {
        color: orange;
      }

      .agent-item {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        margin: 2px 0;
        padding: 2px 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.05);
        font-size: 10px;
      }

      .agent-status {
        margin-right: 4px;
        font-size: 12px;
      }

      .agent-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .agent-name {
        font-weight: bold;
      }

      .agent-details {
        font-size: 9px;
        color: rgba(255, 255, 255, 0.7);
      }

      .agent-details.error {
        color: orange;
      }

      @media (prefers-color-scheme: dark) {
        .agent-item {
          background: rgba(255, 255, 255, 0.1);
        }
        .agent-details {
          color: rgba(255, 255, 255, 0.6);
        }
      }

      /* Scrollbar styling */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }

      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      }
    `;

    static properties = {
      data: {type: String},
      rowkey: {type: String},
      validationResults: {type: Object, state: true}
    };

    constructor() {
      super();
      this.data = '{}';
      this.rowkey = "";
      this.validationResults = null;
    }

    async updated(changedProperties) {
      if (changedProperties.has('data')) {
        await this.performValidation();
      }
    }

    async performValidation() {
      try {
        const schema = JSON.parse(this.data);

        // Check cache first
        const now = Date.now();
        let agents = null;

        if (JsonSchemaValidationWidget.agentCache.data &&
            (now - JsonSchemaValidationWidget.agentCache.timestamp) < JsonSchemaValidationWidget.agentCache.ttl) {
          agents = JsonSchemaValidationWidget.agentCache.data;
          console.log(`[JsonSchemaValidationWidget] Using cached agent data (${agents.length} agents, ${(now - JsonSchemaValidationWidget.agentCache.timestamp)/1000}s old)`);
        } else {
          // Check if there's already a fetch in progress
          if (JsonSchemaValidationWidget.agentCache.fetchPromise) {
            console.log('[JsonSchemaValidationWidget] Waiting for existing fetch...');
            agents = await JsonSchemaValidationWidget.agentCache.fetchPromise;
          } else {
            console.log('[JsonSchemaValidationWidget] Starting new fetch...');
            // Start new fetch and store promise to deduplicate concurrent requests
            JsonSchemaValidationWidget.agentCache.fetchPromise = this.fetchAgents();
            agents = await JsonSchemaValidationWidget.agentCache.fetchPromise;
            JsonSchemaValidationWidget.agentCache.fetchPromise = null; // Clear the promise
          }
        }

        if (agents.length === 0) {
          this.validationResults = { error: 'No agents found to validate against' };
          return;
        }

        // Validate schema against each agent
        const ajv = new Ajv();
        const validate = ajv.compile(schema);

        let validAgents = [];
        let invalidAgents = [];

        for (const agent of agents) {
          const valid = validate(agent.capabilities || {});
          if (valid) {
            validAgents.push(agent);
          } else {
            invalidAgents.push({
              agent,
              errors: validate.errors
            });
          }
        }

        this.validationResults = {
          totalAgents: agents.length,
          validCount: validAgents.length,
          invalidCount: invalidAgents.length,
          validAgents,
          invalidAgents
        };

      } catch (e) {
        this.validationResults = { error: 'Error during validation: ' + e.message };
      }
    }

    async fetchAgents() {
      const headers = {};
      if ("jwt_token" in localStorage) {
        headers["Authorization"] = `Bearer ${localStorage["jwt_token"]}`;
      }

      const response = await fetch('/agenttracker', { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch agents for validation');
      }

      const agentData = await response.json();
      const agents = agentData.agents || [];

      // Update cache
      const now = Date.now();
      JsonSchemaValidationWidget.agentCache.data = agents;
      JsonSchemaValidationWidget.agentCache.timestamp = now;
      console.log(`[JsonSchemaValidationWidget] Fetched and cached ${agents.length} agents`);

      return agents;
    }

    render() {
      let schema = {};
      try {
        schema = JSON.parse(this.data);
      } catch (e) {
        return html`<div>Error parsing JSON schema</div>`;
      }

      if (typeof schema !== 'object' || schema === null) {
        return html`<div>Schema data is not a valid object</div>`;
      }

      return html`<div>
        <div class="validation-container">
          <div class="validation-header">Schema Validation Results</div>
          ${this.renderValidationResults()}
        </div>
      </div>`;
    }

    renderValidationResults() {
      if (!this.validationResults) {
        return html`<div class="validation-results">Validating...</div>`;
      }

      if (this.validationResults.error) {
        return html`<div class="validation-results error">${this.validationResults.error}</div>`;
      }

      const { totalAgents, validCount, invalidCount, validAgents, invalidAgents } = this.validationResults;

      return html`
        <div class="validation-results">
          Validated against ${totalAgents} agents: ${validCount} valid, ${invalidCount} invalid
          ${validAgents.map(agent => this.renderAgentItem(agent, true))}
          ${invalidAgents.map(item => this.renderAgentItem(item.agent, false, item.errors))}
        </div>
      `;
    }

    renderAgentItem(agent, isValid, errors = null) {
      const capabilities = agent.capabilities || {};
      const hostname = capabilities.hostname || agent.ip;
      const arch = capabilities.arch || 'unknown';
      const os = capabilities.os?.os || 'unknown';
      const majorVersion = capabilities.os?.release?.major_version || 'unknown';

      const statusEmoji = isValid ? '✅' : '❌';
      const statusClass = isValid ? 'valid' : 'invalid';

      return html`
        <div class="agent-item">
          <span class="agent-status ${statusClass}">${statusEmoji}</span>
          <div class="agent-info">
            <div class="agent-name">${hostname}</div>
            <div class="agent-details">${os} ${majorVersion} • ${arch}</div>
            ${!isValid && errors ? html`<div class="agent-details error">${errors.map(err => `${err.instancePath} ${err.message}`).join(', ')}</div>` : ''}
          </div>
        </div>
      `;
    }

    getCopyText() {
      return this.data;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'Re-validate against agents', action: () => {
            this.performValidation();
          }
        },
        {
          text: 'Refresh agent cache', action: () => {
            console.log('[JsonSchemaValidationWidget] Manually refreshing agent cache...');
            JsonSchemaValidationWidget.agentCache.data = null;
            JsonSchemaValidationWidget.agentCache.timestamp = 0;
            JsonSchemaValidationWidget.agentCache.fetchPromise = null;
            this.performValidation();
          }
        }
      ];
    }
  }
  customElements.define('widget-jsonschema-validation', JsonSchemaValidationWidget);