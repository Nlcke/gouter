type GouterConfig = {
  App: {};
  LoginStack: {};
  Login: {
    name: string;
  };
  LoginModal: {};
  LoginConfirmationStack: {};
  LoginConfirmation: {
    phone: string;
  };
  LoginDrawer: {};
  Tabs: {};
  Home: {};
  Post: {};
  Profile: {};
};

type GouterState<N extends keyof GouterConfig = keyof GouterConfig> =
  import('gouter').State<GouterConfig, N>;

type GouterScreen<N extends keyof GouterConfig> =
  import('gouter/native').Screen<GouterConfig, N>;
