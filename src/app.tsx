import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Mail, Calendar} from './office';

function sortBy(field: string, primer?: (any) => any, reverse?: boolean) {
    var key = primer ? (x) => { return primer(x[field]) } : (x) => { return x[field] };
    var direction = !reverse ? 1 : -1;
    return (a: any, b: any) => {
        var x = key(a), y = key(b);
        return direction * ((x as any > y as any) - (y as any > x as any));
    }
}

class App {
    private identity: Kurve.Identity;
    private graph: Kurve.Graph;
    private me: Kurve.User;
    private messages: Kurve.Messages;
    private calendarEvents: Kurve.Events;
    private loginNewWindow: boolean;

    private mail = document.getElementById('Mail');
    private calendar = document.getElementById('Calendar');
    private contacts = document.getElementById('Contacts');
    private notes = document.getElementById('Notes');

    constructor() {
        console.log('App initializing');

        var here = document.location;
        this.identity = new Kurve.Identity("b8dd3290-662a-4f91-92b9-3e70fbabe04e",
            here.protocol + '//' + here.host + here.pathname.substring(0, here.pathname.lastIndexOf('/') + 1) + '../public/login.html');
        this.graph = new Kurve.Graph({ identity: this.identity });
        this.me = null;
        this.messages = null;

        var params = document.location.search.replace(/.*?\?/, "").split("&").map(function (kv) { return kv.split('='); }).reduce(function (prev, kva) { prev[kva[0]] = (!kva[1]) ? true : kva[1]; return prev }, {});

        this.loginNewWindow = !window["forceInPlaceLogin"] && !params["inplace"];
        console.log('In place login is ' + !this.loginNewWindow);

        document.getElementById("DoLogin").onclick = (e) => app.Login();
        document.getElementById("DoLogout").onclick = (e) => app.Logout();
        document.getElementById("ShowMail").onclick = (e) => app.ShowMail();
        document.getElementById("ShowCalendar").onclick = (e) => app.ShowCalendar();
        document.getElementById("ShowContacts").onclick = (e) => app.ShowContacts();
        document.getElementById("ShowNotes").onclick = (e) => app.ShowNotes();

        console.log('Checking for identity redirect');
        if (this.identity.checkForIdentityRedirect()) {
            this.LoggedIn()
        }
        this.UpdateLoginState();
    }

    public GetMe(): Kurve.User {
        if (this.me) {
            return this.me;
        }
        console.log('Getting me');
        this.graph.meAsync().then((result) => {
            console.log("Got me.");
            this.me = result;
        });
        return null;
    }

    public GetCalendarEvents() {
        if (this.calendarEvents) {
            return; // Exits the "recursion"
        } else if (!this.me) {
            console.log('Getting me');
            this.graph.meAsync()
                .then(() => {
                    this.GetCalendarEvents()
                });
        } else {
            console.log('Got me.  Now getting calendar events.');
            var now = new Date(Date.now())
            // https://graph.microsoft.com/v1.0/me/calendar/events?$select=subject,location,start,bodyPreview,organizer&$orderby=start/dateTime&$filter=start/dateTime gt '2016-01-20T00:00:00.0000000'
            this.me.calendarAsync("$orderby=start/dateTime&$filter=start/dateTime gt '" + now.toUTCString() + "'")
                .then((calendar) => {
                    console.log('Got calendar.  Now rendering.');
                    // calendar.data.sort(sortBy('start', (item: Kurve.Event) => Date.parse(item.data.start.dateTime)));
                    this.calendarEvents = calendar;
                    this.ShowCalendar();
                });
        }
    }

    public GetMessages() {

        if (this.messages) {
            return;
        } else {
            console.log('Getting me');
            this.graph.meAsync()
                .then((me) => {
                    this.me = me;
                    console.log('Got me.  Now getting messages.');
                    me.messagesAsync().then((messages) => {
                        console.log('Got messages.  Now rendering.');
                        this.messages = messages;
                        this.ShowMail();
                    });
                })

        }
    }
    public UpdateLoginState() {
        if (this.identity.isLoggedIn()) {
            document.getElementById("DoLogin").style.display = "none";
            document.getElementById("DoLogout").style.display = "inherit";
        } else {
            document.getElementById("DoLogin").style.display = "inherit";
            document.getElementById("DoLogout").style.display = "none";
        }
    }

    public LoggedIn() {
        console.log('Successful login.');
        this.UpdateLoginState();
        this.GetMessages();
    }

    public IsLoggedIn(): boolean {
        return this.identity.isLoggedIn();
    }

    public Login() {
        console.log('Login called');
        if (this.loginNewWindow) {
            this.identity.loginAsync()
                .then(() => {
                    this.LoggedIn();
                });
        } else {
            this.identity.loginNoWindow((error) => {
                console.log('LoginNoWindow failed.');
            }); // no .then since it will be caught when the page reloads.
        }
    }

    public Logout() {
        this.identity.logOut();
        this.UpdateLoginState();
    };

    private handleMultiChange = (e) => {
        console.log(JSON.stringify(e));
    }

    private ShowMail() {
        this.mail.style.display = "";
        this.calendar.style.display = this.contacts.style.display = this.notes.style.display = "none";
        if (this.messages) {
            ReactDOM.render(<Mail data={ this.messages.data } mailboxes={["inbox", "sent items"]}/>, this.mail);
        } else {
            this.GetMessages();
        }
    }

    private ShowCalendar() {
        this.calendar.style.display = "";
        this.mail.style.display = this.contacts.style.display = this.notes.style.display = "none";
        if (this.calendarEvents) {
            ReactDOM.render(<Calendar data={ this.calendarEvents.data } />, this.calendar);
        } else {
            this.GetCalendarEvents();
        }
    }

    private ShowContacts() {

    }

    private ShowNotes() {

    }

}


class Storage {
    constructor() { }
    public setItem(key: string, data: any) {
        if (localStorage) {
            try {
                localStorage.setItem(key, JSON.stringify({ data: data }));
            }
            catch (e) {
                console.log("localStorage error " + e);
            }
        }
    }

    public static getItem(key: string) : any {
        if (localStorage) {
            try {
                var data = JSON.parse(localStorage.getItem(key));
                return data && data.data;
            }
            catch (e) {
                console.log('localStorage read error ' + e);
            }
        }
        return null;
    }
}

export class Tools {

    public static Hook(rootObject: any, functionToHook: string, hookingFunction: (...optionalParams: any[]) => void): void {
        var previousFunction = rootObject[functionToHook];

        rootObject[functionToHook] = (...optionalParams: any[]) => {
            hookingFunction(optionalParams);
            previousFunction.apply(rootObject, optionalParams);
        }
        return previousFunction;
    }


    public static CreateCookie(name: string, value: string, days: number): void {
        var expires: string;
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        } else {
            expires = "";
        }

        document.cookie = name + "=" + value + expires + "; path=/";
    }

    public static ReadCookie(name: string): string {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }

            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length);
            }
        }
        return "";
    }

}

var app = new App();
window["myapp"] = app;
Tools.Hook(window, 'open', (args) => {
    console.log("window.open(url=" + args[0] + ")")
});

