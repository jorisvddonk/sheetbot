import { html, css, LitElement, createRef, ref } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class LoginElement extends LitElement {
    static styles = css`
        form {
            max-width: 400px;
            margin: 50px auto;
            padding: 20px;
            border: 1px solid var(--text-color);
            border-radius: 8px;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
        }

        label {
            margin-bottom: 5px;
            font-weight: bold;
            color: var(--text-color);
        }

        input {
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid var(--text-color);
            border-radius: 4px;
            font-size: 16px; /* Prevents zoom on iOS */
            width: 100%;
            box-sizing: border-box;
            background-color: var(--bg-color);
            color: var(--text-color);
        }

        input:focus {
            outline: 2px solid var(--header-bg);
        }

        button {
            padding: 10px 20px;
            background-color: var(--header-bg);
            color: var(--header-text);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            align-self: flex-start;
        }

        button:hover {
            background-color: var(--header-bg);
            opacity: 0.8;
        }

        span {
            margin-top: 10px;
            color: #ff6b6b;
            font-weight: bold;
        }

        @media (max-width: 480px) {
            form {
                margin: 20px;
                padding: 15px;
            }

            input, button {
                font-size: 16px;
            }
        }
    `;

    static properties = {
        status: { type: String}
    };

    usernameRef = createRef();
    passwordRef = createRef();
    buttonRef = createRef();
    statusRef = createRef();

    constructor() {
        super();
        this.status = "";
    }
    
    render() {
        return html`<form @submit="${this.login}">
            <label for="username">Username:</label><br>
            <input type="text" id="username" name="username" ${ref(this.usernameRef)}><br>
            <label for="password">Password:</label><br>
            <input type="password" id="password" name="password" ${ref(this.passwordRef)}>
            <button ${ref(this.buttonRef)} @click="${this.login}">login</button>
        </form><span>${this.status}</span>`;
    }

    login(event) {
        event.preventDefault();
        const data = {
            username: this.usernameRef.value.value,
            password: this.passwordRef.value.value
        }
        fetch("/login", {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        }).then((response) => {
            if (response.status === 200) {
                response.json().then(data => {
                    localStorage["jwt_token"] = data.token;
                    this.status = "login successful";
                })
            } else {
                this.status = "error";
            }
        }).catch((err) => {
            console.error(err);
            this.status = "error";
        });
    }
}
customElements.define('element-login', LoginElement);