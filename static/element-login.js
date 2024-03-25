import { html, css, LitElement, createRef, ref } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class LoginElement extends LitElement {
    static styles = css``;

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