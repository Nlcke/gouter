type Config = {
  App: {};
  LoginStack: {};
  Login: {
    name: string;
  };
  LoginModal: {};
  Stats: {
    animation?: 'slide' | 'rotation';
  };
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

type State<N extends keyof Config = keyof Config> =
  import('gouter/state').GouterState<Config, N>;

type GouterScreen<N extends keyof Config> =
  import('gouter/native').GouterScreen<Config, N>;
