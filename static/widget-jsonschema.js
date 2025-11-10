import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class JsonSchemaWidget extends LitElement {
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

      .schema {
        border: 1px solid rgba(128, 128, 128, 0.3);
        margin: 0 1px 1px 1px;
        padding: 1px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
        width: calc(100% - 4px);
      }

      @media (prefers-color-scheme: dark) {
        .schema {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
      }

      .schema-header {
        font-weight: bold;
        margin-bottom: 1px;
        color: inherit;
      }

      .schema-detail {
        font-size: 10px;
        color: inherit;
        margin: 0 0 0 4px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: calc(100% - 4px);
        font-family: monospace;
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
      rowkey: {type: String}
    };

    constructor() {
      super();
      this.data = '{}';
      this.rowkey = "";
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
        <div class="schema">
          <div class="schema-detail">${JSON.stringify(schema, null, 2)}</div>
        </div>
      </div>`;
    }

    getCopyText() {
      return this.data;
    }

    async validateAgainstAgents() {
      try {
        const schema = JSON.parse(this.data);

        // Fetch agents
        const headers = {};
        if ("jwt_token" in localStorage) {
          headers["Authorization"] = `Bearer ${localStorage["jwt_token"]}`;
        }

        const response = await fetch('/agenttracker', { headers });
        if (!response.ok) {
          alert('Failed to fetch agents for validation');
          return;
        }

        const agentData = await response.json();
        const agents = agentData.agents || [];

        if (agents.length === 0) {
          alert('No agents found to validate against');
          return;
        }

        // Validate schema against each agent
        const ajv = new Ajv();
        const validate = ajv.compile(schema);

        let validCount = 0;
        let invalidAgents = [];

        for (const agent of agents) {
          const valid = validate(agent.capabilities || {});
          if (valid) {
            validCount++;
          } else {
            invalidAgents.push({
              ip: agent.ip,
              errors: validate.errors
            });
          }
        }

        // Show results
        if (invalidAgents.length === 0) {
          alert(`✓ Schema is valid for all ${agents.length} agents`);
        } else {
          let message = `Schema validation results:\n✓ Valid for ${validCount}/${agents.length} agents\n`;
          if (invalidAgents.length > 0) {
            message += `\n✗ Invalid for ${invalidAgents.length} agents:\n`;
            invalidAgents.forEach(agent => {
              message += `\n${agent.ip}:\n${JSON.stringify(agent.errors, null, 2)}\n`;
            });
          }
          alert(message);
        }

      } catch (e) {
        alert('Error during validation: ' + e.message);
      }
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'Validate against all agents', action: () => {
            this.validateAgainstAgents();
          }
        }
      ];
    }
  }
  customElements.define('widget-jsonschema', JsonSchemaWidget);