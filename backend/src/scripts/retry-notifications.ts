import {requestNotifications} from '../services/request-notification.runtime.js';
import {prisma} from '../config/database.js';
import {env} from '../config/env.js';

// Operator/scheduler entry point. Requires platform DB/SES credentials, never target AWS account credentials.
if((env.NOTIFICATION_EMAIL_MODE??env.INVITATION_EMAIL_MODE)!=='ses')throw new Error('SES notifications are disabled. No deliveries attempted.');
try{await requestNotifications.retry(undefined,undefined,100)}finally{await prisma.$disconnect()}
