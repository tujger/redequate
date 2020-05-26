import {notifySnackbar} from "./Notifications";

const User = (data) => {
  let private_ = null, public_ = null, uid_ = null, role_ = null;
  let body = {
    "private": () => private_,
    "public": () => public_,
    role: () => role_,
    uid: () => uid_,
    set: (type, data) => {
      if (data === "null") data = null;
      if (type === "private") private_ = data;
      else if (type === "public") public_ = data;
      else if (type === "uid") uid_ = data;
      else if (type === "role") role_ = data;
      else console.error(`Unknown type "${type}" set to "${data}"`);
    },
    parse: data => {
      if (data.public) {
        public_ = data.public;
        private_ = data.private;
        uid_ = data.uid;
        role_ = data.role;
      } else {
        const {address, created, email, emailVerified, image, name, phone, provider, uid, role} = data;
        uid_ = uid;
        role_ = role;
        public_ = {
          created, address, email, emailVerified, image, name, phone, provider
        }
      }
    },
    toString: () => JSON.stringify(toJSON()),
    toJSON: () => toJSON(),
  };
  const toJSON = () => ({"public": public_, "private": private_, uid: uid_, role: role_});
  if (data) body.parse(data);
  return body;
};

export default User;

export const fetchUserPublic = firebase => uid => new Promise((resolve, reject) => {
  fetchUserSection(firebase, "public", uid, resolve, reject);
});

export const fetchUserPrivate = firebase => (uid, deviceId) => new Promise((resolve, reject) => {
  let section = "private";
  if (deviceId) {
    section = "private/" + deviceId;
  }
  fetchUserSection(firebase, section, uid, resolve, reject);
});

const fetchUserSection = (firebase, section, uid, onsuccess, onerror) => {
  const db = firebase.database();
  if (uid) {
    db.ref("users").child(uid).child(section).once("value").then(snapshot => {
      let val = snapshot.val() || {};
      db.ref("users").child(uid).child("role").once("value").then(snapshot => {
        val.role = snapshot.val();
        onsuccess && onsuccess(val);
      }).catch(error => {
        val.role = val.emailVerified ? Role.USER : Role.USER_NOT_VERIFIED;
        onsuccess && onsuccess(val);
      });
    }).catch(onerror);
  } else {
    try {
      // logoutUser(firebase)();
      onsuccess && onsuccess(null);
    } catch (e) {
      onerror(e);
    }
  }
};

export const updateUserPublic = firebase => (uid, props) => new Promise((resolve, reject) => {
  updateUserSection(firebase, "public", uid, props, resolve, reject);
});

export const updateUserPrivate = firebase => (uid, deviceId = "", props) =>
  new Promise((resolve, reject) => {
    let section = "private";
    if (!props && deviceId instanceof Object) {
      props = deviceId;
    } else {
      section = "private/" + deviceId;
    }
    updateUserSection(firebase, section, uid, props, resolve, reject);
  });

const updateUserSection = (firebase, section, uid, props, onsuccess, onerror) => {
  const db = firebase.database();
  if (uid) {
    fetchUserSection(firebase, section, uid, data => {
      const {role, uid: ignored1, ...existed} = data;
      const {current, role: ignored2, uid: ignored3, ...updates} = props;
      let val = {...existed, ...updates};
      db.ref("users").child(uid).child(section).set(val);
      if (current || user.uid() === uid) {
        user.set(section.split("/")[0], val);
        user.set("uid", uid);
        user.set("role", role);
        window.localStorage.setItem("user_uid", uid);
        window.localStorage.setItem("user_role", role);
        window.localStorage.setItem("user_" + (section.split("/")[0]), JSON.stringify(val));
      }
      onsuccess && onsuccess(val);
    }, onerror);
  } else {
    onerror(new Error("UID is not defined"));
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

export const watchUserChanged = firebase => {
  firebase.auth().onAuthStateChanged(result => {
    console.log("[AuthStateChanged]", result);
  });
};

export const logoutUser = firebase => () => {
  window.localStorage.removeItem("user_public");
  window.localStorage.removeItem("user_private");
  window.localStorage.removeItem("user_uid");
  window.localStorage.removeItem("user_role");
  window.localStorage.removeItem("notification-token");
  user.set("private", null);
  user.set("public", null);
  user.set("role", null);
  user.set("uid", null);
  firebase.auth().signOut();
};

export const user = User();
user.set("public", JSON.parse(window.localStorage.getItem("user_public")));
user.set("private", JSON.parse(window.localStorage.getItem("user_private")));
user.set("role", window.localStorage.getItem("user_role"));
user.set("uid", window.localStorage.getItem("user_uid"));

export const currentRole = user => {
  if (user && user.uid() && !user.role()) {
    // console.error("Current user role is invalid, reset ro USER");
    return Role.USER;
  }
  return user ? user.role() || Role.LOGIN : Role.LOGIN;
};

export const matchRole = (roles, user) => {
  if (!roles) return true;
  if (roles.indexOf(Role.AUTH) >= 0) return true;
  if (!currentRole(user)) return false;
  return roles.indexOf(currentRole(user)) >= 0;
};

export const needAuth = (roles, user) => {
  if (!roles) return false;
  return currentRole(user) === Role.LOGIN;
};

export const roleIs = (role, user) => {
  if (!role) return true;
  if (!currentRole(user)) return false;
  return role.indexOf(currentRole(user)) >= 0;
};

export const Role = {
  AUTH: "auth",
  ADMIN: "admin",
  LOGIN: "login",
  USER: "user",
  USER_NOT_VERIFIED: "userNotVerified"
};

export const sendConfirmationEmail = (firebase, store) => options => new Promise((resolve, reject) => {
  let actionCodeSettings = {
    url: window.location.origin + "/signup" + (options.includeEmail ? "?email=" + options.email : ""),
    handleCodeInApp: true,
  };
  firebase.auth().sendSignInLinkToEmail(options.email, actionCodeSettings).then(() => {
    window.localStorage.setItem("emailForSignIn", options.email);
    notifySnackbar({
      title: "Confirmation email has sent"
    });
    resolve();
  }).catch(error => {
    notifySnackbar({
      title: error.message,
      variant: "error"
    });
    reject(error);
  });
});
