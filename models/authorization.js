function can(user, feature, resource) {
  let authorizhed = false;

  if (user.features.includes(feature)) {
    authorizhed = true;
  }

  if (feature == "update:user" && resource) {
    authorizhed = false;

    if (user.id === resource.id || can(user, "update:user:others")) {
      authorizhed = true;
    }
  }

  return authorizhed;
}

const authorizationModel = {
  can,
};

export default authorizationModel;
