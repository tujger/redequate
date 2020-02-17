import Snackbar from "../components/Snackbar";

export const fetchUser = firebase => (uid, onsuccess, onerror) => {
    const db = firebase.database();
    if (uid) {
        db.ref("users").child(uid).once("value").then(snapshot => {
            let val = snapshot.val() || {};
            val.uid = uid;
            db.ref("admin").child(uid).child("role").once("value").then(snapshot => {
                val.role = snapshot.val();
                onsuccess && onsuccess(val);
            }).catch(error => {
                val.role = val.emailVerified ? Role.USER : Role.USER_NOT_VERIFIED;
                onsuccess && onsuccess(val);
            });
        }).catch(onerror);
    } else {
        try {
            logoutUser(firebase)();
            onsuccess && onsuccess();
        } catch(e) {
            onerror(e);
        }
    }
};

export const updateUser = firebase => (user, onsuccess, onerror) => {
    const db = firebase.database();
    if (user) {
        db.ref("users").child(user.uid).once("value").then(snapshot => {
            let val = snapshot.val() || {};
            let data = snapshot.val() || {};
            data.address = firstOf(user.address, val.address);
            data.created = firstOf(user.created, val.created, new Date().getTime());
            data.email = firstOf(user.email, val.email);
            data.emailVerified = firstOf(user.emailVerified, val.emailVerified);
            data.image = firstOf(user.photoURL, user.image, val.image);
            data.name = firstOf(user.displayName, user.name, val.name);
            data.phone = firstOf(user.phoneNumber, user.phone, val.phone);
            data.provider = firstOf(user.providerData ? (user.providerData[0] && user.providerData[0].providerId) || user.providerId : user.providerId, val.provider);
            if(val.role !== Role.ADMIN) {
                data.role = firstOf(user.emailVerified !== undefined ? (user.emailVerified ? Role.USER : Role.USER_NOT_VERIFIED) : Role.USER, val.role);
            }
            db.ref("users").child(user.uid).set(data);
            data.uid = user.uid;
            if(user.current || (currentUser && currentUser.uid === data.uid)) {
                currentUser = data;
                window.localStorage.setItem("user", JSON.stringify(data));
            }
            onsuccess && onsuccess(data);
        }).catch(onerror);
    } else {
        try {
            logoutUser(firebase)();
            onsuccess && onsuccess();
        } catch(e) {
            onerror(e);
        }
    }
};

export const firstOf = (...args) => {
    for (let i in args) {
        if (args[i] !== undefined && args[i] !== null && args[i] !== "") {
            return args[i];
        }
    }
    return null;
};

let currentUser = JSON.parse(window.localStorage.getItem("user"));
// firebase.auth().onAuthStateChanged(fetchUser);

export const logoutUser = firebase => () => {
    window.localStorage.removeItem("user");
    currentUser = null;
    firebase.auth().signOut();
};

const User = () => {
    let body = {
        currentUser: () => currentUser,
    };
    return body;
};

export default User;

export const user = User();

export const currentRole = currentUser => {
    if (currentUser && !currentUser.role) {
        console.error("Current user role is invalid, reset ro USER", currentUser);
        return Role.USER;
    }
    return currentUser ? currentUser.role || Role.LOGIN : Role.LOGIN;
};

export const matchRole = (roles, currentUser) => {
    if (!roles) return true;
    if (roles.indexOf(Role.AUTH) >= 0) return true;
    if (!currentRole(currentUser)) return false;
    return roles.indexOf(currentRole(currentUser)) >= 0;
};

export const needAuth = (roles, currentUser) => {
    if (!roles) return false;
    return currentRole(currentUser) === Role.LOGIN;
};

export const roleIs = (role, currentUser) => {
    if (!role) return true;
    if (!currentRole(currentUser)) return false;
    return role.indexOf(currentRole(currentUser)) >= 0;
};

export const Role = {
    AUTH: "auth",
    ADMIN: "admin",
    LOGIN: "login",
    USER: "user",
    USER_NOT_VERIFIED: "userNotVerified"
};

export const sendConfirmationEmail = (firebase, store) => options => {
    let actionCodeSettings = {
        url: window.location.origin + "/signup" + (options.includeEmail ? "?email=" + options.email : ""),
        handleCodeInApp: true,
    };
    firebase.auth().sendSignInLinkToEmail(options.email, actionCodeSettings).then(() => {
        window.localStorage.setItem("emailForSignIn", options.email);
        store && store.dispatch({type:Snackbar.SHOW, message: "Confirmation email has sent"});
        if (options.onsuccess) {
            options.onsuccess();
        } else {
            console.log("Confirmation email has sent");
        }
    }).catch(error => {
        store && store.dispatch({type:Snackbar.SHOW, message: error.message});
        if (options.onerror) {
            options.onerror(error);
        } else {
            console.error(error);
        }
    });
};
