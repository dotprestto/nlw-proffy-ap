import db from '../database/connection'
import convertHourToMinutes from '../utils/convertHourToMinutes'
import { Request, Response } from 'express'

interface ScheduleItem {
    week_day: number
    from: string
    to: string
}
export default class ClassesController {
    async index(req: Request, res: Response) {
        const filters = req.query
        if(!filters.week_day || !filters.subject || !filters.time)
            return res.status(400).json({
                error: "Missing filters to search classes."
            })

        const timeInMinutes = convertHourToMinutes(filters.time as string)

        const classes = await db('classes')
            .whereExists(function() {
                this.select('class_schedule.*')
                    .from('class_schedule')
                    .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
                    .whereRaw('`class_schedule`.`week_day` = ??', [Number(filters.week_day)])
                    .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
                    .whereRaw('`class_schedule`.`to` > ??', [timeInMinutes])
                })
            .where('classes.subject', '=', filters.subject as string)
            .join('users', 'classes.user_id', '=', 'users.id')
            .select(['classes.*', 'users.*'])
        return res.json(classes)
    }

    async create(req: Request, res: Response) {
        const { 
            name, 
            avatar,
            whatsapp, 
            bio, 
            subject,
            cost, 
            schedule 
         } = req.body
     
         const trx = await db.transaction()
         try {
     
             const inserted_users_ids = await trx('users').insert({
                 name, 
                 avatar,
                 whatsapp, 
                 bio
             })
     
             const user_id = inserted_users_ids[0] 
     
             const inserted_classes_ids = await trx('classes').insert({
                 subject,
                 cost,
                 user_id
             })
     
             const class_id = inserted_classes_ids[0]
     
             const class_schedule = schedule.map((scheduleItem: ScheduleItem) => {
                 return {
                     week_day: scheduleItem.week_day,
                     from: convertHourToMinutes(scheduleItem.from),
                     to: convertHourToMinutes(scheduleItem.to),
                     class_id
                 }
             })
     
             await trx('class_schedule').insert(class_schedule)
     
             await trx.commit()
     
             return res.status(201).end()
         } catch (error) {
             return res.status(400).json({
                 error: "Unexpected error while creating classes",
                 stack: error.stack
             })
         }
    }
}