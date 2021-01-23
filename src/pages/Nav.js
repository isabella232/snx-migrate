import React from 'react';
import clsx from 'clsx';
import { Link, withRouter } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import { BORDER_RADIUS, SECONDARY_COLOR } from 'config';

const useStyles = makeStyles(theme => ({
  container: {
    borderTopLeftRadius: BORDER_RADIUS,
    borderTopRightRadius: BORDER_RADIUS,
  },
  tab: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    textTransform: 'uppercase',
    background: '#0f0439',
    '&:first-child': {
      borderTopLeftRadius: BORDER_RADIUS,
    },
    '&:last-child': {
      borderTopRightRadius: BORDER_RADIUS,
    },
    '&:hover': {
      background: '#160069',
    },
  },
  activeTab: {
    color: SECONDARY_COLOR,
  },
}));

const TABS = ['nominate', 'merge'];

export default withRouter(function() {
  const classes = useStyles();
  const path = window.location.hash.replace('#/', '');

  return (
    <Box
      className={clsx(
        classes.container,
        'flex',
        'flex-grow',
        'items-center',
        'justify-center'
      )}
    >
      {TABS.map(tab => (
        <Link
          key={tab}
          className={clsx(
            'flex-grow',
            'text-center',
            'cursor-pointer',
            classes.tab,
            {
              [classes.activeTab]: path === tab,
            }
          )}
          to={tab}
        >
          <Box px={4} py={2}>
            {tab}
          </Box>
        </Link>
      ))}
    </Box>
  );
});
