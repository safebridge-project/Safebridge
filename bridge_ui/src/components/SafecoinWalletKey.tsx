import { makeStyles } from "@material-ui/core";
import DisconnectIcon from "@material-ui/icons/LinkOff";
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@safecoin/wallet-adapter-material-ui";
import { useSafecoinWallet } from "../contexts/SafecoinWalletContext";

const useStyles = makeStyles((theme) => ({
  root: {
    textAlign: "center",
    margin: `${theme.spacing(1)}px auto`,
    width: "100%",
    maxWidth: 400,
  },
  disconnectButton: {
    marginLeft: theme.spacing(1),
  },
}));

const SafecoinWalletKey = () => {
  const classes = useStyles();
  const wallet = useSafecoinWallet();

  return (
    <div className={classes.root}>
      <WalletMultiButton />
      {wallet && (
        <WalletDisconnectButton
          startIcon={<DisconnectIcon />}
          className={classes.disconnectButton}
        />
      )}
    </div>
  );
};

export default SafecoinWalletKey;
