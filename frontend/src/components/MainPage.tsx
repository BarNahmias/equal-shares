import { useEffect, useState } from 'react';

import {
  Button,
  ButtonGroup,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';

import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

import { DataResponse, Project } from '../schemas';
import { postDataRequest, postVoteRequest } from '../api';

import ProjectCard from './ProjectCard';

import logoImage from '../assets/logo.png';

const TOAST_ID_MAX_POINTS = 'max-points';

function sortedProjects(projects: Project[]): Project[] {
  return projects.sort((a, b) => a.rank - b.rank);
}

export type Props = {
  email: string;
  token: string;
};

export default function MainPage({ email, token }: Props) {
  const [voted, setVoted] = useState<boolean>(false);
  const [maxTotalPoints, setMaxTotalPoints] = useState<number>(1);
  const [pointsStep, setPointsStep] = useState<number>(1);
  const [projects, setProjects] = useState<Project[]>([]);

  const [dragDisabled, setDragDisabled] = useState<boolean>(false);
  const [sendingRequest, setSendingRequest] = useState<boolean>(false);

  const availablePoints = projects.reduce((acc, project) => acc - project.points, maxTotalPoints);

  const markedProjects = projects.filter((project) => project.marked);
  const unmarkedProjects = projects.filter((project) => !project.marked);

  useEffect(() => {
    setSendingRequest(true);
    postDataRequest(email, token)
      .then((data: DataResponse) => {
        setVoted(data.voted);
        setMaxTotalPoints(data.max_total_points);
        setPointsStep(data.points_step);
        setProjects(data.projects);
        setSendingRequest(false);
      })
      .catch(() => {
        toast.error('אירעה שגיאה בטעינת הדירוג');
        setSendingRequest(false);
      });
  }, [email, token]);

  const pointsSliderOnChange = (project: Project, value: number | number[]) => {
    if (typeof value !== 'number') {
      return;
    }

    value = Math.min(project.max_points, value);
    value = Math.max(project.min_points, value);

    if (availablePoints + project.points - value < 0) {
      value = project.points + availablePoints;
      toast('נגמר התקציב, כדי להוסיף הורד מפרוייקט אחר', {
        type: 'error',
        toastId: TOAST_ID_MAX_POINTS
      });
    }

    project.points = Math.round(value / pointsStep) * pointsStep;
    project.points_text = project.points.toString();
    setProjects(sortedProjects([...projects]));
  };

  const pointsBoxOnChange = (project: Project, textValue: string) => {
    project.points_text = textValue;

    const value = parseInt(project.points_text, 10);

    if (!isNaN(value) && project.min_points <= value && value <= project.max_points) {
      if (project.points + availablePoints < value) {
        toast('נגמר התקציב, כדי להוסיף הורד מפרוייקט אחר', {
          type: 'error',
          toastId: TOAST_ID_MAX_POINTS
        });
      }

      project.points = Math.min(value, project.points + availablePoints);
      project.points_text = project.points.toString();
    }

    setProjects(sortedProjects([...projects]));
  };

  const pointsBoxOnBlur = (project: Project) => {
    project.points = Math.round(project.points / pointsStep) * pointsStep;
    project.points_text = project.points.toString();
    setProjects(sortedProjects([...projects]));
  };

  const markedOnChange = (project: Project) => {
    if (!project.marked) {
      if (availablePoints - project.min_points < 0) {
        toast('אין מספיק יתרת תקציב להסיף את הפרוייקט הזה, הסר מפרוייקט אחר', {
          type: 'error',
          toastId: TOAST_ID_MAX_POINTS
        });
        return;
      }
    }

    project.marked = !project.marked;
    project.points = project.marked ? project.min_points : 0;
    project.points_text = project.points.toString();

    project.points_text = project.points.toString();

    const markedProjects = projects.filter((project) => project.marked);
    const unmarkedProjects = projects.filter((project) => !project.marked);

    const newProjects = [...markedProjects, ...unmarkedProjects].map((project, index) => {
      project.rank = index + 1;
      return project;
    });

    setProjects(sortedProjects([...newProjects]));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const draggedProject = projects[result.source.index - 1];
    const destinationProject = projects[result.destination.index - 1];

    if (draggedProject.marked !== destinationProject.marked) {
      if (destinationProject.marked) {
        if (availablePoints - draggedProject.min_points < 0) {
          toast('אין מספיק יתרת תקציב להסיף את הפרוייקט הזה, הסר מפרוייקט אחר', {
            type: 'error',
            toastId: TOAST_ID_MAX_POINTS
          });
          return;
        }
      }
      draggedProject.marked = destinationProject.marked;
      draggedProject.points = draggedProject.marked ? draggedProject.min_points : 0;
      draggedProject.points_text = draggedProject.points.toString();
    }

    const reorderedProjects = Array.from(projects);
    const [removed] = reorderedProjects.splice(result.source.index - 1, 1);
    reorderedProjects.splice(result.destination.index - 1, 0, removed);

    const sortedProjects = reorderedProjects.map((project, index) => {
      project.rank = index + 1;
      return project;
    });

    setProjects(sortedProjects);
  };

  const saveOnClick = () => {
    if (sendingRequest) {
      return;
    }

    const toastId = toast.loading('שומר את הדירוג...', { type: 'info', position: 'top-center' });

    setSendingRequest(true);
    postVoteRequest(email, token, {
      projects: sortedProjects(projects).map((project) => ({
        id: project.id,
        rank: project.rank,
        points: project.points,
        marked: project.marked
      }))
    }).then((data) => {
      toast.update(toastId, {
        render: 'הדירוג נשמר בהצלחה!',
        type: 'success',
        position: 'top-center',
        autoClose: 5000,
        isLoading: false
      });
      setVoted(data.voted);
      setMaxTotalPoints(data.max_total_points);
      setPointsStep(data.points_step);
      setProjects(data.projects);
      setSendingRequest(false);
    });
  };

  return (
    <Container component="main" maxWidth={false} sx={{ maxWidth: 800 }}>
      <div className="justify-items-center item-center">
        <Typography className="text-center" variant="h3" component="h1" gutterBottom>
          דירוג פרוייקטים
        </Typography>
        <div className="w-full h-[300px] flex justify-center">
          <img
            className="w-[150px] h-[150px] my-[75px]"
            src={logoImage}
            alt="Logo"
            width={150}
            height={150}
          />
        </div>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>איך מדרגים?</AccordionSummary>
          <AccordionDetails>
            <ul className="list-disc px-[20px]">
              <li>לחצו על "עריכה" על מנת להתחיל בדירוג.</li>
              <li>
                החליטו איזה קורסים אתם מוכנים לקחת, סמנו אותם ב-V ומחקו את הסימון מהקורסים שאתם לא
                מוכנים לקחת.
              </li>
              <li>
                גררו וסדרו את הקורסים שאתם מוכנים לקחת לפי סדר העדיפות שלכם - שימו למעלה את הקורסים
                שאתם הכי רוצים.{' '}
              </li>
              <li>
                חלקו את 1000 הנקודות שלכם בין הקורסים שאתם מוכנים לקחת - תנו יותר נקודות לקורסים
                שאתם רוצים יותר.
              </li>
              <li>ניתן להשתמש בחיצי המקלדת לניקוד מדויק יותר.</li>
              <li>לאחר שסיימתם, לחצו על "שמירת הדירוג".</li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>שימו לב</AccordionSummary>
          <AccordionDetails>
            <ul className="list-disc px-[20px]">
              <li>
                אם לא סימנתם V ליד "מוכן/ה לקחת", לא תקבלו את הקורס בשום מקרה - גם אם לא יישאר מקום
                בקורסים אחרים.{' '}
              </li>
              <li>בעת שמירת הדירוג, יתרת הדירוג חייבת לעמוד על 0 נקודות בדיוק.</li>
            </ul>
          </AccordionDetails>
        </Accordion>
        <div className="mt-[10px]">
          <Typography className="text-center" variant="h4" component="h2" gutterBottom>
            הדירוג ייסגר ב: 13/08 בשעה 23:00
          </Typography>
        </div>
        <div className="w-full mt-[5px] flex justify-center">
          <Alert className="w-fit" severity="info">
            יתרת ניקוד: {availablePoints}
          </Alert>
        </div>
        <div className="w-full mt-[10px] flex justify-center">
          <div className="ml-[25px] my-auto">
            <Typography variant="body1" component="p">
              דוגמאות לניקוד
            </Typography>
          </div>
          <ButtonGroup variant="outlined" dir="ltr">
            <Button>איפוס הכל</Button>
            <Button>חלוקה שווה</Button>
            <Button>חלוקה לפי הסדר</Button>
          </ButtonGroup>
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="droppable">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {markedProjects.map((project) => (
                  <Draggable
                    key={project.id}
                    draggableId={project.id.toString()}
                    index={project.rank}
                    isDragDisabled={dragDisabled}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={provided.draggableProps.style}>
                        <ProjectCard
                          project={project}
                          pointsStep={pointsStep}
                          pointsSliderOnChange={pointsSliderOnChange}
                          pointsBoxOnChange={pointsBoxOnChange}
                          pointsBoxOnBlur={pointsBoxOnBlur}
                          markedOnChange={markedOnChange}
                          setDragDisabled={setDragDisabled}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {unmarkedProjects.length > 0 && (
                  <>
                    <div className="mt-[30px]"></div>
                    {unmarkedProjects.map((project) => (
                      <Draggable
                        key={project.id}
                        draggableId={project.id.toString()}
                        index={project.rank}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}>
                            <ProjectCard
                              project={project}
                              pointsStep={pointsStep}
                              pointsSliderOnChange={pointsSliderOnChange}
                              pointsBoxOnChange={pointsBoxOnChange}
                              pointsBoxOnBlur={pointsBoxOnBlur}
                              markedOnChange={markedOnChange}
                              setDragDisabled={setDragDisabled}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="mt-[10px] flex justify-center">
          <Button
            color="primary"
            variant="contained"
            onClick={saveOnClick}
            disabled={sendingRequest || availablePoints < 0}>
            {voted ? 'עדכון הדירוג' : 'שלח הדירוג'}
          </Button>
        </div>
      </div>
    </Container>
  );
}
