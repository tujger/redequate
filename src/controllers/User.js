import Snackbar from "../components/Snackbar";

// deprecated
export const fetchUser = firebase => (uid, onsuccess, onerror) => {
  const db = firebase.database();
  if (uid) {
    db.ref("users").child(uid).child("public").once("value").then(snapshot => {
      let val = snapshot.val() || {};
      val.uid = uid;
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
      logoutUser(firebase)();
      onsuccess && onsuccess();
    } catch (e) {
      onerror(e);
    }
  }
};

// deprecated
export const updateUser = firebase => (user, onsuccess, onerror) => {
  const db = firebase.database();
  if (user) {
    db.ref("users").child(user.uid).child("public").once("value").then(snapshot => {
      let val = snapshot.val() || {};
      let data = snapshot.val() || {};
      data.address = firstOf(user.address, val.address);
      data.created = firstOf(user.created, val.created, new Date().getTime());
      data.email = firstOf(user.email, val.email);
      data.emailVerified = firstOf(user.emailVerified, val.emailVerified);
      data.image = firstOf(user.image, user.photoURL, val.image);
      data.name = firstOf(user.name, user.displayName, val.name);
      data.phone = firstOf(user.phone, user.phoneNumber, val.phone);
      data.provider = firstOf(user.providerData ? (user.providerData[0] && user.providerData[0].providerId) || user.providerId : user.providerId, val.provider);
      db.ref("users").child(user.uid).child("public").set(data);
      if (user.role !== Role.ADMIN) {
        data.role = firstOf(user.emailVerified !== undefined ? (user.emailVerified ? Role.USER : Role.USER_NOT_VERIFIED) : Role.USER, user.role);
      } else {
        data.role = user.role;
      }
      data.uid = user.uid;
      if (user.current || (currentUser && currentUser.uid === data.uid)) {
        currentUser = data;
        window.localStorage.setItem("user", JSON.stringify(data));
      }
      onsuccess && onsuccess(data);
    }).catch(onerror);
  } else {
    try {
      logoutUser(firebase)();
      onsuccess && onsuccess();
    } catch (e) {
      onerror(e);
    }
  }
};

export const updateUserPublic = firebase => (uid, props) => new Promise((resolve, reject) => {
  updateUserSection(firebase, "public", uid, props, result => resolve(result), error => reject(error));
});

export const updateUserPrivate = firebase => (uid, props) => new Promise((resolve, reject) => {
  updateUserSection(firebase, "private", uid, props, result => resolve(result), error => reject(error));
});

const updateUserSection = (firebase, section, uid, props, onsuccess, onerror) => {
  const db = firebase.database();
  if (uid) {
    fetchUserSection(firebase, section, uid, data => {
      const {role, ...existed} = data;
      const {current, uid: _uid, ...other} = props;
      let val = {...existed, ...other};
      db.ref("users").child(uid).child(section).set(val);
      val = {...val, uid, role};
      if (current || (currentUser && currentUser.uid === uid)) {
        if(section === "private") currentUserPrivate = val;
        else currentUser = val;
        window.localStorage.setItem("user_uid", uid);
        window.localStorage.setItem("user_" + section, JSON.stringify(val));
      }
      onsuccess && onsuccess(val);

    }, onerror);
  } else {
    onerror(e);
  }
};

export const fetchUserPublic = firebase => uid => new Promise((resolve, reject) => {
  fetchUserSection(firebase, "public", uid, result => resolve(result), error => reject(error));
});

export const fetchUserPrivate = firebase => uid => new Promise((resolve, reject) => {
  fetchUserSection(firebase, "private", uid, result => resolve(result), error => reject(error));
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

export const firstOf = (...args) => {
  for (let i in args) {
    if (args[i] !== undefined && args[i] !== null && args[i] !== "") {
      return args[i];
    }
  }
  return null;
};

let currentUser = JSON.parse(window.localStorage.getItem("user_public"));
let currentUserPrivate = JSON.parse(window.localStorage.getItem("user_private"));

export const watchUserChanged = firebase => {
  firebase.auth().onAuthStateChanged(result => {
    console.log("AUTHCHANGED", result);
  });
}

export const logoutUser = firebase => () => {
  window.localStorage.removeItem("user");
  currentUser = null;
  firebase.auth().signOut();
};

const User = () => {
  let body = {
    currentUser: () => currentUser,
    currentUserPrivate: () => currentUserPrivate,
  };
  return body;
};

export default User;

export const user = User();

export const currentRole = user => {
  if (user && !user.role) {
    // console.error("Current user role is invalid, reset ro USER", currentUser);
    return Role.USER;
  }
  return user ? user.role || Role.LOGIN : Role.LOGIN;
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

export const sendConfirmationEmail = (firebase, store) => options => {
  let actionCodeSettings = {
    url: window.location.origin + "/signup" + (options.includeEmail ? "?email=" + options.email : ""),
    handleCodeInApp: true,
  };
  firebase.auth().sendSignInLinkToEmail(options.email, actionCodeSettings).then(() => {
    window.localStorage.setItem("emailForSignIn", options.email);
    store && store.dispatch({type: Snackbar.SHOW, message: "Confirmation email has sent"});
    if (options.onsuccess) {
      options.onsuccess();
    } else {
      console.log("Confirmation email has sent");
    }
  }).catch(error => {
    store && store.dispatch({type: Snackbar.SHOW, message: error.message});
    if (options.onerror) {
      options.onerror(error);
    } else {
      console.error(error);
    }
  });
};
